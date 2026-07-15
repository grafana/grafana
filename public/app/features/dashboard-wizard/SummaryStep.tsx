import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Icon, Input, Stack, Text, useStyles2 } from '@grafana/ui';

import { type WizardSummary } from './types';

interface Props {
  /** The assistant's plain-language plan; falls back to `fallbackText` when absent. */
  summary?: WizardSummary;
  /** The refined build prompt, shown when the model returned no structured summary. */
  fallbackText: string;
  /** Names of the datasources the dashboard will be built from. */
  datasourceNames: string[];
  /** The clarifying questions the user answered, if any. */
  clarifications: Array<{ question: string; answer: string }>;
  /** True while a refine round-trip is in flight. */
  busy?: boolean;
  /** Ask the assistant to change the plan based on the user's feedback. */
  onRefine: (feedback: string) => void;
  onGenerate: () => void;
  onBack: () => void;
}

/**
 * Review screen shown before the build: a panel-by-panel preview of the
 * dashboard the assistant is about to generate. The user can confirm, refine
 * the plan with feedback, or go back and adjust their answers.
 */
export function SummaryStep({
  summary,
  fallbackText,
  datasourceNames,
  clarifications,
  busy,
  onRefine,
  onGenerate,
  onBack,
}: Props) {
  const styles = useStyles2(getStyles);
  const [feedback, setFeedback] = useState('');
  const hasSections = summary && summary.sections.length > 0;

  // Clear the feedback field once an updated plan comes back.
  useEffect(() => {
    setFeedback('');
  }, [summary]);

  const submitFeedback = () => {
    if (!busy && feedback.trim() !== '') {
      onRefine(feedback);
    }
  };

  return (
    <div className={styles.container}>
      <Text element="h3" variant="h5">
        {t('dashboard-wizard.summary-step.title', "Here's what we'll build")}
      </Text>

      <div className={styles.card}>
        <div className={styles.header}>
          <Icon name="apps" size="lg" className={styles.accent} />
          <Text element="h4" variant="h5">
            {summary?.title ?? t('dashboard-wizard.summary-step.default-title', 'New dashboard')}
          </Text>
        </div>

        <Text color="secondary">{summary?.description ? summary.description : fallbackText}</Text>

        {summary?.layout && (
          <div className={styles.layout}>
            <Icon name="layer-group" size="sm" className={styles.accent} />
            <Text variant="bodySmall" color="secondary">
              {summary.layout}
            </Text>
          </div>
        )}

        {hasSections && (
          <div className={styles.sections}>
            {summary.sections.map((section, index) => (
              <div key={index} className={styles.section}>
                <Text variant="bodySmall" weight="medium">
                  {section.title}
                </Text>
                <ul className={styles.panels}>
                  {section.panels.map((panel, panelIndex) => (
                    <li key={panelIndex} className={styles.panel}>
                      {panel.visualization && <span className={styles.vizChip}>{panel.visualization}</span>}
                      <span className={styles.panelTitle}>{panel.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {datasourceNames.length > 0 && (
        <div className={styles.meta}>
          <Text variant="bodySmall" weight="medium" color="secondary">
            {t('dashboard-wizard.summary-step.data-sources', 'Data sources')}
          </Text>
          <div className={styles.chips}>
            {datasourceNames.map((name) => (
              <span key={name} className={styles.chip}>
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {clarifications.length > 0 && (
        <div className={styles.meta}>
          <Text variant="bodySmall" weight="medium" color="secondary">
            {t('dashboard-wizard.summary-step.your-choices', 'Your choices')}
          </Text>
          <Stack direction="column" gap={0.5}>
            {clarifications.map((clarification) => (
              <Text key={clarification.question} variant="bodySmall" color="secondary">
                {clarification.question} — {clarification.answer}
              </Text>
            ))}
          </Stack>
        </div>
      )}

      <div className={styles.meta}>
        <Text variant="bodySmall" weight="medium" color="secondary">
          {t('dashboard-wizard.summary-step.refine-label', 'Not quite right? Tell the assistant what to change')}
        </Text>
        <div className={styles.refineRow}>
          <div className={styles.refineInput}>
            <Input
              value={feedback}
              onChange={(event) => setFeedback(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  submitFeedback();
                }
              }}
              placeholder={t(
                'dashboard-wizard.summary-step.refine-placeholder',
                'e.g. add a section for cache hit ratio, or use a table for errors'
              )}
              disabled={busy}
            />
          </div>
          <Button
            variant="secondary"
            icon={busy ? 'spinner' : 'sync'}
            disabled={busy || feedback.trim() === ''}
            onClick={submitFeedback}
          >
            {t('dashboard-wizard.summary-step.update-plan', 'Update plan')}
          </Button>
        </div>
      </div>

      <Stack justifyContent="space-between">
        <Button variant="secondary" fill="outline" onClick={onBack}>
          {t('dashboard-wizard.summary-step.back', 'Back')}
        </Button>
        <Button onClick={onGenerate} icon="ai-sparkle" disabled={busy}>
          {t('dashboard-wizard.summary-step.generate', 'Generate dashboard')}
        </Button>
      </Stack>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
    }),
    card: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1.5),
      padding: theme.spacing(2),
      borderRadius: theme.shape.radius.default,
      border: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.secondary,
    }),
    header: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
    }),
    accent: css({
      color: theme.colors.primary.text,
      flexShrink: 0,
    }),
    layout: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
    }),
    sections: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1.5),
      marginTop: theme.spacing(0.5),
    }),
    section: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.75),
      paddingLeft: theme.spacing(1.5),
      borderLeft: `2px solid ${theme.colors.border.medium}`,
    }),
    panels: css({
      listStyle: 'none',
      margin: 0,
      padding: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
    }),
    panel: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.primary,
    }),
    vizChip: css({
      flexShrink: 0,
      padding: theme.spacing(0, 0.75),
      height: theme.spacing(2.5),
      lineHeight: theme.spacing(2.5),
      borderRadius: theme.shape.radius.default,
      background: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      color: theme.colors.text.secondary,
      fontSize: theme.typography.pxToRem(11),
      textTransform: 'capitalize',
      whiteSpace: 'nowrap',
    }),
    panelTitle: css({
      minWidth: 0,
    }),
    meta: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
    }),
    chips: css({
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(0.5),
    }),
    chip: css({
      padding: theme.spacing(0.25, 1),
      borderRadius: theme.shape.radius.default,
      border: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.primary,
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    refineRow: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
    }),
    refineInput: css({
      flex: 1,
    }),
  };
}
