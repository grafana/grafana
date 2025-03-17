import { useFormContext } from 'react-hook-form';

import { Button, Stack, Text } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { RuleFormValues } from '../../../types/rule-form';
import { isRecordingRuleByType } from '../../../utils/rules';
import { NeedHelpInfo } from '../NeedHelpInfo';

import { LabelsInRule } from './LabelsField';

interface LabelsFieldInFormProps {
  onEditClick: () => void;
}
export function LabelsFieldInForm({ onEditClick }: LabelsFieldInFormProps) {
  const { watch } = useFormContext<RuleFormValues>();
  const labels = watch('labels');
  const type = watch('type');

  const isRecordingRule = type ? isRecordingRuleByType(type) : false;

  const text = isRecordingRule
    ? t('alerting.alertform.labels.recording', 'Add labels to your rule.')
    : t(
        'alerting.alertform.labels.alerting',
        'Add labels to your rule for searching, silencing, or routing to a notification policy.'
      );

  const hasLabels = Object.keys(labels).length > 0 && labels.some((label) => label.key || label.value);

  return (
    <Stack direction="column" gap={2}>
      <Stack direction="column" gap={1}>
        <Text element="h5">Labels</Text>
        <Stack direction={'row'} gap={1}>
          <Text variant="bodySmall" color="secondary">
            {text}
          </Text>
          <NeedHelpInfo
            externalLink={'https://grafana.com/docs/grafana/latest/alerting/fundamentals/alert-rules/annotation-label/'}
            linkText={`Read about labels`}
            contentText="The dropdown only displays labels that you have previously used for alerts.
              Select a label from the options below or type in a new one."
            title="Labels"
          />
        </Stack>
      </Stack>
      <Stack direction="row" gap={1} alignItems="center">
        <LabelsInRule labels={labels} />
        {hasLabels ? (
          <Button variant="secondary" type="button" onClick={onEditClick} size="sm">
            Edit labels
          </Button>
        ) : (
          <Stack direction="row" gap={2} alignItems="center">
            <Text>No labels selected</Text>
            <Button
              icon="plus"
              type="button"
              variant="secondary"
              onClick={onEditClick}
              size="sm"
              data-testid="add-labels-button"
            >
              Add labels
            </Button>
          </Stack>
        )}
      </Stack>
    </Stack>
  );
}
