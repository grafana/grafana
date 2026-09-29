import { t, Trans } from '@grafana/i18n';
import { Button, IconButton, Input, Stack } from '@grafana/ui';

interface Props {
  value: string[];
  onChange: (value: string[]) => void;
}

/**
 * Author-defined follow-ups, in the order the viewer sees them. Shared by the Configure insight
 * modal and the Text panel's Insight options so both offer the same editing experience.
 */
export function InsightFollowUpsList({ value, onChange }: Props) {
  const replace = (index: number, next: string) =>
    onChange(value.map((followUp, at) => (at === index ? next : followUp)));

  return (
    <Stack direction="column" gap={1}>
      {value.map((followUp, index) => (
        // Index-keyed on purpose: the value is what the author is editing, so keying on it
        // would remount the input on every keystroke and lose focus.
        <Stack key={index} direction="row" gap={0.5} alignItems="center">
          <Input
            value={followUp}
            placeholder={t('dashboard.insight-panel.follow-up-placeholder', 'Which service drove the change?')}
            onChange={(event) => replace(index, event.currentTarget.value)}
          />
          <IconButton
            name="trash-alt"
            tooltip={t('dashboard.insight-panel.follow-up-remove', 'Remove follow-up')}
            onClick={() => onChange(value.filter((_, at) => at !== index))}
          />
        </Stack>
      ))}
      <div>
        <Button size="sm" variant="secondary" icon="plus" onClick={() => onChange([...value, ''])}>
          <Trans i18nKey="dashboard.insight-panel.follow-up-add">Add follow-up</Trans>
        </Button>
      </div>
    </Stack>
  );
}
