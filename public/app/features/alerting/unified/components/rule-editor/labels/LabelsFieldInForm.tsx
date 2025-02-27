import { useFormContext } from 'react-hook-form';

import { Button, Stack, Text } from '@grafana/ui';

import { RuleFormValues } from '../../../types/rule-form';

import { LabelsInRule } from './LabelsField';

interface LabelsFieldInFormProps {
  onEditClick: () => void;
}
export function LabelsFieldInForm({ onEditClick }: LabelsFieldInFormProps) {
  const { watch } = useFormContext<RuleFormValues>();
  const labels = watch('labels');

  const hasLabels = Object.keys(labels).length > 0 && labels.some((label) => label.key || label.value);

  return (
    <Stack direction="row" alignItems="center">
      {hasLabels ? (
        <>
          <LabelsInRule labels={labels} />
          <Button variant="secondary" type="button" onClick={onEditClick} size="sm">
            Edit labels
          </Button>
        </>
      ) : (
        <Stack direction="row" gap={2} alignItems="center">
          <Text variant="bodySmall" color="secondary" italic>
            No labels selected
          </Text>
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
  );
}
