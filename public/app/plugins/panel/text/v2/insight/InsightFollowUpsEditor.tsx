import { type StandardEditorProps } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, IconButton, Input, Stack } from '@grafana/ui';

/** Author-defined follow-ups, in the order the viewer sees them. */
export function InsightFollowUpsEditor({ value, onChange }: StandardEditorProps<string[]>) {
  const followUps = value ?? [];

  const replace = (index: number, next: string) =>
    onChange(followUps.map((followUp, at) => (at === index ? next : followUp)));

  return (
    <Stack direction="column" gap={1}>
      {followUps.map((followUp, index) => (
        // Index-keyed on purpose: the value is what the author is editing, so keying on it
        // would remount the input on every keystroke and lose focus.
        <Stack key={index} direction="row" gap={0.5} alignItems="center">
          <Input
            value={followUp}
            placeholder={t('textng.insight.follow-up-placeholder', 'Which service drove the change?')}
            onChange={(event) => replace(index, event.currentTarget.value)}
          />
          <IconButton
            name="trash-alt"
            tooltip={t('textng.insight.follow-up-remove', 'Remove follow-up')}
            onClick={() => onChange(followUps.filter((_, at) => at !== index))}
          />
        </Stack>
      ))}
      <div>
        <Button size="sm" variant="secondary" icon="plus" onClick={() => onChange([...followUps, ''])}>
          <Trans i18nKey="textng.insight.follow-up-add">Add follow-up</Trans>
        </Button>
      </div>
    </Stack>
  );
}
