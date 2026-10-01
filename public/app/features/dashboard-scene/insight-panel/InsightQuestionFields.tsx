import { useId } from 'react';

import { t } from '@grafana/i18n';
import { Field, Stack, Switch, TextArea } from '@grafana/ui';
import { type InsightOptions } from 'app/plugins/panel/text/panelcfg.gen';

import { type DashboardSceneLike } from '../scene/types/dashboard';
import { InsightBreakdownPicker } from '../sidebar/insights/InsightBreakdownPicker';
import { InsightSourcePicker } from '../sidebar/insights/InsightSourcePicker';
import { InsightSuggestions } from '../sidebar/insights/InsightSuggestions';
import { type InsightSourcePanel } from '../sidebar/insights/sources';

import { InsightFollowUpsList } from './InsightFollowUpsList';

interface Props {
  dashboard: DashboardSceneLike | undefined;
  value: InsightOptions;
  sources: InsightSourcePanel[];
  onChange: (value: InsightOptions) => void;
  autoFocus?: boolean;
}

/**
 * The question, sources, follow-ups, and comparison settings of an insight, worded like the Text panel's
 * Insight options. Shared by the Configure insight modal and the sidebar's saved questions.
 */
export function InsightQuestionFields({ dashboard, value, sources, onChange, autoFocus }: Props) {
  const questionId = useId();
  const compareId = useId();
  const breakdownId = useId();

  return (
    <Stack direction="column" gap={2}>
      <Stack direction="column" gap={1}>
        <Field
          noMargin
          htmlFor={questionId}
          label={t('dashboard.insight-panel.question-label', 'Question')}
          description={t(
            'dashboard.insight-panel.question-description',
            'What Assistant answers using only the data the source panels show.'
          )}
        >
          <TextArea
            id={questionId}
            autoFocus={autoFocus}
            rows={4}
            value={value.question}
            placeholder={t('dashboard.insight-panel.question-placeholder', 'What changed in error rates this week?')}
            onChange={(event) => onChange({ ...value, question: event.currentTarget.value })}
          />
        </Field>
        <InsightSuggestions
          dashboard={dashboard}
          sources={sources}
          onPick={({ question, sourcePanelKeys }) => onChange({ ...value, question, sourcePanelKeys })}
        />
      </Stack>

      <Field
        noMargin
        label={t('dashboard.insight-panel.sources-label', 'Source panels')}
        description={t(
          'dashboard.insight-panel.sources-description',
          'Assistant answers using only the data these panels show. Selecting a tab or row includes every panel in it.'
        )}
      >
        <InsightSourcePicker
          sources={sources}
          value={value.sourcePanelKeys}
          onChange={(sourcePanelKeys) => onChange({ ...value, sourcePanelKeys })}
        />
      </Field>

      <Field
        noMargin
        label={t('dashboard.insight-panel.follow-ups-label', 'Follow-up questions')}
        description={t(
          'dashboard.insight-panel.follow-ups-description',
          'Optional. Offered after the answer, each one answered against the same data.'
        )}
      >
        <InsightFollowUpsList value={value.followUps} onChange={(followUps) => onChange({ ...value, followUps })} />
      </Field>

      <Field
        noMargin
        htmlFor={compareId}
        label={t('dashboard.insight-panel.compare-label', 'Compare with previous period')}
        description={t(
          'dashboard.insight-panel.compare-description',
          'Also captures the source panels over the period just before the time range, so the answer can say what changed. Runs extra queries when asking.'
        )}
      >
        <Switch
          id={compareId}
          value={Boolean(value.compareWithPreviousPeriod)}
          onChange={(event) => onChange({ ...value, compareWithPreviousPeriod: event.currentTarget.checked })}
        />
      </Field>

      <Field
        noMargin
        htmlFor={breakdownId}
        label={t('dashboard.insight-panel.breakdown-label', 'Break down by')}
        description={t(
          'dashboard.insight-panel.breakdown-description',
          'Optional. Captures the source panels that use this variable once per selected value, so the answer can compare them. Runs extra queries when asking.'
        )}
      >
        <InsightBreakdownPicker
          id={breakdownId}
          dashboard={dashboard}
          value={value.breakdownVariable}
          onChange={(breakdownVariable) => onChange({ ...value, breakdownVariable })}
        />
      </Field>
    </Stack>
  );
}

export function isInsightComplete(insight: InsightOptions): boolean {
  return insight.question.trim() !== '' && insight.sourcePanelKeys.length > 0;
}

export function cleanInsight(insight: InsightOptions): InsightOptions {
  return {
    question: insight.question.trim(),
    sourcePanelKeys: insight.sourcePanelKeys,
    // Blank rows are the author's in-progress input, not questions to offer.
    followUps: insight.followUps.map((followUp) => followUp.trim()).filter(Boolean),
    // Unset rather than false or empty, so turning an option off leaves the saved question as it was.
    ...(insight.compareWithPreviousPeriod === true && { compareWithPreviousPeriod: true }),
    ...(insight.breakdownVariable ? { breakdownVariable: insight.breakdownVariable } : {}),
  };
}
