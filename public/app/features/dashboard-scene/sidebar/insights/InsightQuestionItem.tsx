import { css } from '@emotion/css';
import { useId, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Alert, Button, Icon, IconButton, Spinner, Stack, Text, useStyles2 } from '@grafana/ui';
import { getFocusStyles } from '@grafana/ui/internal';

import { type DashboardInsightsPane } from './DashboardInsightsPane';
import { InsightAnswerView } from './InsightAnswerView';
import { InsightQuestionForm } from './InsightQuestionForm';
import { InsightSourceLinks } from './InsightSourceLinks';
import { openInsightFollowUp } from './followUp';
import { deleteInsightQuestion, moveInsightQuestion, updateInsightQuestion } from './insightsEditActions';
import { type InsightsDashboard } from './insightsStorage';
import { getMissingRefLabel } from './sections';
import { captureInsightSnapshot } from './snapshot';
import { type InsightSourcePanel } from './sources';
import { getInsightStaleReasons } from './staleness';
import { type InsightQuestion, type InsightRun } from './types';

interface Props {
  pane: DashboardInsightsPane;
  dashboard: InsightsDashboard;
  questions: InsightQuestion[];
  index: number;
  sources: InsightSourcePanel[];
  run?: InsightRun;
  isOpen: boolean;
  isEditing: boolean;
  isFormOpen: boolean;
  onEdit: () => void;
  onCloseForm: () => void;
}

export function InsightQuestionItem({
  pane,
  dashboard,
  questions,
  index,
  sources,
  run,
  isOpen,
  isEditing,
  isFormOpen,
  onEdit,
  onCloseForm,
}: Props) {
  const styles = useStyles2(getStyles);
  const bodyId = useId();
  const [followUpError, setFollowUpError] = useState<string>();
  const question = questions[index];
  const showForm = isEditing && isFormOpen;

  const header = (
    <div className={styles.header}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={isOpen}
        aria-controls={bodyId}
        onClick={() => pane.toggleExpanded(question.id)}
      >
        <Icon name={isOpen ? 'angle-down' : 'angle-right'} className={styles.toggleIcon} />
        <span>{question.question}</span>
      </button>
      {isEditing && (
        <Stack gap={0.5}>
          <IconButton
            name="pen"
            size="sm"
            tooltip={t('dashboard.insights.item.edit', 'Edit question')}
            onClick={onEdit}
          />
          <IconButton
            name="arrow-up"
            size="sm"
            tooltip={t('dashboard.insights.item.move-up', 'Move up')}
            disabled={index === 0}
            onClick={() => moveInsightQuestion(dashboard, questions, index, -1)}
          />
          <IconButton
            name="arrow-down"
            size="sm"
            tooltip={t('dashboard.insights.item.move-down', 'Move down')}
            disabled={index === questions.length - 1}
            onClick={() => moveInsightQuestion(dashboard, questions, index, 1)}
          />
          <IconButton
            name="trash-alt"
            size="sm"
            tooltip={t('dashboard.insights.item.delete', 'Delete question')}
            onClick={() => deleteInsightQuestion(dashboard, questions, question.id)}
          />
        </Stack>
      )}
    </div>
  );

  if (showForm) {
    return (
      <div className={styles.item}>
        {header}
        <div className={styles.body}>
          <InsightQuestionForm
            initial={question}
            sources={sources}
            onSave={(draft) => {
              updateInsightQuestion(dashboard, questions, question.id, draft);
              onCloseForm();
            }}
            onCancel={onCloseForm}
          />
        </div>
      </div>
    );
  }

  if (!isOpen) {
    return <div className={styles.item}>{header}</div>;
  }

  const running = run?.running ?? false;
  const result = run?.result;
  const capture = captureInsightSnapshot(dashboard, question);
  // Asking loads off-screen sources, so they neither block the action nor count as changed data.
  const unavailable = capture.unloaded ? undefined : capture.unavailable;
  const staleReasons = result
    ? getInsightStaleReasons(
        result.snapshot,
        capture.context,
        capture.keys,
        capture.snapshot ?? (capture.unloaded ? result.snapshot : undefined)
      )
    : [];
  const ask = () => void pane.ask(question);

  const onFollowUp = () => {
    if (!result) {
      return;
    }
    setFollowUpError(undefined);
    try {
      openInsightFollowUp(result, staleReasons.length > 0);
    } catch (error) {
      setFollowUpError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className={styles.item}>
      {header}
      <div className={styles.body} id={bodyId}>
        <Stack direction="column" gap={1.5}>
          <div>
            <Text variant="bodySmall" color="secondary">
              <Trans i18nKey="dashboard.insights.item.sources-label">Sources</Trans>
            </Text>
            <InsightSourceLinks
              items={question.sourcePanelKeys.map((key) => ({
                key,
                title: result?.snapshot.panels.find((panel) => panel.key === key)?.title ?? getMissingRefLabel(key),
              }))}
              sources={sources}
            />
          </div>

          {unavailable && !running && (
            <Text element="p" variant="bodySmall" color="warning">
              {unavailable}
            </Text>
          )}

          {run?.error && (
            <Alert
              severity="error"
              title={t('dashboard.insights.item.error-title', 'Assistant could not answer')}
              bottomSpacing={0}
            >
              {run.error}
            </Alert>
          )}

          {result && staleReasons.length > 0 && (
            <Alert severity="warning" title={t('dashboard.insights.item.stale-title', 'Out of date')} bottomSpacing={0}>
              <Stack direction="column" gap={1} alignItems="flex-start">
                <span>{staleReasons.join(', ')}</span>
                <Button
                  size="sm"
                  variant="secondary"
                  icon="sync"
                  disabled={running || Boolean(unavailable)}
                  onClick={ask}
                >
                  <Trans i18nKey="dashboard.insights.item.ask-again">Ask Assistant again</Trans>
                </Button>
              </Stack>
            </Alert>
          )}

          {running && (
            <Stack gap={1} alignItems="center">
              <Spinner inline />
              <Text color="secondary">
                {run?.loadingSources ? (
                  <Trans i18nKey="dashboard.insights.item.loading-sources">Loading source panels…</Trans>
                ) : (
                  <Trans i18nKey="dashboard.insights.item.running">Analyzing selected panels…</Trans>
                )}
              </Text>
            </Stack>
          )}

          {result && <InsightAnswerView result={result} sources={sources} onFollowUp={onFollowUp} />}

          {!result && !running && (
            <Stack direction="column" gap={1} alignItems="flex-start">
              <Text element="p" variant="bodySmall" color="secondary">
                <Trans i18nKey="dashboard.insights.item.ask-hint">
                  Get a takeaway and supporting findings from the source panels. Answers stay in this session.
                </Trans>
              </Text>
              <Button size="sm" icon="ai-sparkle" disabled={Boolean(unavailable)} onClick={ask}>
                <Trans i18nKey="dashboard.insights.item.ask">Ask Assistant</Trans>
              </Button>
            </Stack>
          )}

          {followUpError && (
            <Alert
              severity="error"
              title={t('dashboard.insights.item.follow-up-error-title', 'Could not open Assistant')}
              bottomSpacing={0}
            >
              {followUpError}
            </Alert>
          )}
        </Stack>
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    item: css({
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      background: theme.colors.background.primary,
    }),
    header: css({
      display: 'flex',
      alignItems: 'flex-start',
      gap: theme.spacing(1),
      padding: theme.spacing(1),
    }),
    toggle: css({
      display: 'flex',
      alignItems: 'flex-start',
      gap: theme.spacing(0.5),
      flex: 1,
      minWidth: 0,
      padding: 0,
      border: 'none',
      background: 'none',
      color: theme.colors.text.primary,
      fontWeight: theme.typography.fontWeightMedium,
      textAlign: 'left',
      overflowWrap: 'anywhere',
      cursor: 'pointer',
      borderRadius: theme.shape.radius.default,
      '&:focus-visible': getFocusStyles(theme),
    }),
    toggleIcon: css({
      flexShrink: 0,
      marginTop: 2,
    }),
    body: css({
      padding: theme.spacing(0, 1, 1.5, 3.5),
    }),
  };
}
