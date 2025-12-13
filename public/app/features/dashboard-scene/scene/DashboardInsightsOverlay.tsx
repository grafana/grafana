import { css } from '@emotion/css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createAssistantContextItem, OpenAssistantButton } from '@grafana/assistant';
import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { llm } from '@grafana/llm';
import { reportInteraction } from '@grafana/runtime';
import { Button, Icon, Spinner, useStyles2 } from '@grafana/ui';

import { DashboardScene } from './DashboardScene';

interface Props {
  dashboard: DashboardScene;
}

enum StreamStatus {
  IDLE = 'idle',
  GENERATING = 'generating',
  COMPLETED = 'completed',
  ERROR = 'error',
}

/**
 * A floating overlay that displays AI-generated insights about the dashboard.
 * Automatically fetches and shows a summary when the dashboard loads.
 */
export function DashboardInsightsOverlay({ dashboard }: Props) {
  const styles = useStyles2(getStyles);
  const [isVisible, setIsVisible] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [summary, setSummary] = useState('');
  const [streamStatus, setStreamStatus] = useState<StreamStatus>(StreamStatus.IDLE);
  const [isLLMEnabled, setIsLLMEnabled] = useState<boolean | null>(null);
  const hasAutoTriggered = useRef(false);

  const { uid, title, description } = dashboard.useState();

  // Build the dashboard context for the LLM
  const dashboardContext = useMemo(() => {
    const saveModel = dashboard.getSaveModel();
    const panels =
      'panels' in saveModel && saveModel.panels
        ? saveModel.panels.map((panel) => ({
            title: panel.title,
            type: panel.type,
            description: 'description' in panel ? panel.description : undefined,
          }))
        : [];

    return `Dashboard: "${title}"
${description ? `Description: ${description}` : ''}
Panels (${panels.length}):
${panels.map((p, i) => `- ${p.title || 'Untitled'} (${p.type})${p.description ? `: ${p.description}` : ''}`).join('\n')}`;
  }, [dashboard, title, description]);

  const fetchSummary = useCallback(async () => {
    if (streamStatus === StreamStatus.GENERATING) {
      return;
    }

    setStreamStatus(StreamStatus.GENERATING);
    setSummary('');

    reportInteraction('grafana_dashboard_insights_summary_requested', {
      origin: 'dashboard-overlay',
      dashboardUid: uid,
    });

    const messages: llm.Message[] = [
      {
        role: 'system',
        content:
          'You analyze Grafana dashboards. Be extremely concise. No filler words. No repetition. Just key insights in 1-2 short sentences. Start directly with the insight, no preamble.',
      },
      {
        role: 'user',
        content: `What does this dashboard monitor and what's notable about it?\n\n${dashboardContext}`,
      },
    ];

    try {
      let accumulatedContent = '';

      const stream = llm.streamChatCompletions({
        model: llm.Model.LARGE,
        messages,
      });

      stream.pipe(llm.accumulateContent()).subscribe({
        next: (content) => {
          accumulatedContent = content;
          setSummary(content);
        },
        error: (error) => {
          console.error('Failed to generate dashboard summary:', error);
          setStreamStatus(StreamStatus.ERROR);
        },
        complete: () => {
          setSummary(accumulatedContent);
          setStreamStatus(StreamStatus.COMPLETED);
        },
      });
    } catch (error) {
      console.error('Failed to generate dashboard summary:', error);
      setStreamStatus(StreamStatus.ERROR);
    }
  }, [streamStatus, uid, dashboardContext]);

  // Create assistant context for opening the full assistant
  const assistantContext = useMemo(() => {
    const saveModel = dashboard.getSaveModel();

    return createAssistantContextItem('structured', {
      title: `Dashboard: ${title}`,
      data: {
        dashboard: {
          uid,
          title,
          description,
          panels:
            'panels' in saveModel && saveModel.panels
              ? saveModel.panels.map((panel) => ({
                  id: panel.id,
                  title: panel.title,
                  type: panel.type,
                  description: 'description' in panel ? panel.description : undefined,
                }))
              : [],
        },
      },
    });
  }, [dashboard, uid, title, description]);

  // Check if LLM is enabled
  useEffect(() => {
    llm.health().then((response) => {
      setIsLLMEnabled(response.ok);
    });
  }, []);

  // Auto-trigger summary on mount
  useEffect(() => {
    if (isLLMEnabled && uid && !hasAutoTriggered.current && streamStatus === StreamStatus.IDLE) {
      hasAutoTriggered.current = true;
      // Small delay to ensure dashboard is loaded
      const timer = setTimeout(() => {
        fetchSummary();
      }, 1000);
      return () => clearTimeout(timer);
    }
    return;
  }, [isLLMEnabled, uid, streamStatus, fetchSummary]);

  // Don't render if LLM is not enabled or checking, or no UID
  if (isLLMEnabled === null || !isLLMEnabled || !uid) {
    return null;
  }

  if (!isVisible) {
    return null;
  }

  if (isMinimized) {
    return (
      <div className={styles.minimizedOverlay}>
        <button
          className={styles.minimizedButton}
          onClick={() => setIsMinimized(false)}
          title={t('dashboard.insights.expand', 'Expand insights')}
        >
          <Icon name="ai-sparkle" size="sm" />
          <span>{t('dashboard.insights.title', 'Dashboard Insights')}</span>
          <Icon name="angle-up" size="sm" />
        </button>
      </div>
    );
  }

  return (
    <div className={styles.overlay} data-testid="dashboard-insights-overlay">
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <Icon name="ai-sparkle" size="sm" />
          <span>{t('dashboard.insights.title', 'Dashboard Insights')}</span>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.headerButton}
            onClick={() => setIsMinimized(true)}
            title={t('dashboard.insights.minimize', 'Minimize')}
          >
            <Icon name="angle-down" size="md" />
          </button>
          <button
            className={styles.headerButton}
            onClick={() => setIsVisible(false)}
            title={t('dashboard.insights.close', 'Close')}
          >
            <Icon name="times" size="md" />
          </button>
        </div>
      </div>
      <div className={styles.content}>
        {streamStatus === StreamStatus.GENERATING && !summary && (
          <div className={styles.loading}>
            <Spinner size="sm" />
            <span>{t('dashboard.insights.analyzing', 'Analyzing dashboard...')}</span>
          </div>
        )}
        {streamStatus === StreamStatus.ERROR && (
          <div className={styles.error}>
            <span>{t('dashboard.insights.error', 'Failed to generate insights')}</span>
            <Button size="sm" variant="secondary" onClick={fetchSummary}>
              {t('dashboard.insights.retry', 'Retry')}
            </Button>
          </div>
        )}
        {summary && (
          <div className={styles.summary}>
            <p>{summary}</p>
            {streamStatus === StreamStatus.GENERATING && <Spinner size="xs" inline />}
          </div>
        )}
        {streamStatus === StreamStatus.COMPLETED && (
          <div className={styles.actions}>
            <OpenAssistantButton
              prompt={`Analyze this dashboard "${title}" and provide detailed insights. What is its purpose and what key observations are there?`}
              origin="dashboard"
              context={[assistantContext]}
              title={t('dashboard.insights.analyze-in-assistant', 'Analyze dashboard in Assistant')}
              size="sm"
              onClick={() => setIsVisible(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    overlay: css({
      position: 'fixed',
      bottom: theme.spacing(3),
      right: theme.spacing(3),
      width: 340,
      maxWidth: 'calc(100vw - 48px)',
      backgroundColor: theme.colors.background.primary,
      borderRadius: theme.shape.radius.default,
      boxShadow: theme.shadows.z3,
      border: `1px solid ${theme.colors.border.weak}`,
      zIndex: theme.zIndex.modal,
      overflow: 'hidden',
    }),
    minimizedOverlay: css({
      position: 'fixed',
      bottom: theme.spacing(3),
      right: theme.spacing(3),
      zIndex: theme.zIndex.modal,
    }),
    minimizedButton: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(1, 2),
      backgroundColor: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      boxShadow: theme.shadows.z3,
      cursor: 'pointer',
      color: theme.colors.text.primary,
      fontSize: theme.typography.bodySmall.fontSize,

      '&:hover': {
        backgroundColor: theme.colors.action.hover,
      },
    }),
    header: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing(1.5, 2),
      backgroundColor: theme.colors.background.secondary,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    headerTitle: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.primary,
    }),
    headerActions: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
    }),
    headerButton: css({
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      padding: theme.spacing(0.5),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: theme.colors.text.secondary,
      borderRadius: theme.shape.radius.default,

      '&:hover': {
        backgroundColor: theme.colors.action.hover,
        color: theme.colors.text.primary,
      },
    }),
    content: css({
      padding: theme.spacing(2),
      minHeight: 60,
    }),
    loading: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      color: theme.colors.text.secondary,
    }),
    error: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      color: theme.colors.error.text,
    }),
    summary: css({
      color: theme.colors.text.primary,
      lineHeight: 1.6,
      fontSize: theme.typography.bodySmall.fontSize,

      '& p': {
        margin: 0,
      },
    }),
    actions: css({
      display: 'flex',
      justifyContent: 'flex-end',
      marginTop: theme.spacing(1),
      paddingTop: theme.spacing(1),
      borderTop: `1px solid ${theme.colors.border.weak}`,
    }),
  };
}
