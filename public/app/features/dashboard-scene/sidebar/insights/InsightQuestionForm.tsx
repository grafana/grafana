import { useState } from 'react';

import { Trans } from '@grafana/i18n';
import { Button, Stack } from '@grafana/ui';

import { cleanInsight, InsightQuestionFields, isInsightComplete } from '../../insight-panel/InsightQuestionFields';
import { type DashboardSceneLike } from '../../scene/types/dashboard';

import { type InsightQuestionDraft } from './insightsEditActions';
import { type InsightSourcePanel } from './sources';

interface Props {
  dashboard: DashboardSceneLike;
  initial?: InsightQuestionDraft;
  sources: InsightSourcePanel[];
  onSave: (draft: InsightQuestionDraft) => void;
  onCancel: () => void;
}

export function InsightQuestionForm({ dashboard, initial, sources, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<InsightQuestionDraft>(() => ({
    question: initial?.question ?? '',
    sourcePanelKeys: initial?.sourcePanelKeys ?? [],
    followUps: initial?.followUps ?? [],
    compareWithPreviousPeriod: initial?.compareWithPreviousPeriod,
    breakdownVariable: initial?.breakdownVariable,
  }));
  const canSave = isInsightComplete(draft);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (canSave) {
          onSave(cleanInsight(draft));
        }
      }}
    >
      <Stack direction="column" gap={2}>
        <InsightQuestionFields dashboard={dashboard} value={draft} sources={sources} onChange={setDraft} autoFocus />
        <Stack gap={1}>
          <Button type="submit" size="sm" disabled={!canSave}>
            <Trans i18nKey="dashboard.insights.form.save-question">Save</Trans>
          </Button>
          <Button type="button" size="sm" variant="secondary" fill="outline" onClick={onCancel}>
            <Trans i18nKey="dashboard.insights.form.cancel-edit">Cancel</Trans>
          </Button>
        </Stack>
      </Stack>
    </form>
  );
}
