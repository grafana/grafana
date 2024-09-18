import React from 'react';
import { useFormContext } from 'react-hook-form';

import { Button, Stack, Text } from '@grafana/ui';

import { RuleFormValues } from '../../../types/rule-form';
import { NeedHelpInfo } from '../NeedHelpInfo';

import { LabelsInRule } from './LabelsField';

interface LabelsFieldInFormProps {
  onEditClick: () => void;
}
export function LabelsFieldInForm({ onEditClick }: LabelsFieldInFormProps) {
  const { watch } = useFormContext<RuleFormValues>();
  const labels = watch('labels');
  const hasLabels = Object.keys(labels).length > 0 && labels.some((label) => label.key || label.value);

  return (
    <Stack direction="column" gap={2}>
      <Stack direction="column" gap={1}>
        <Text element="h5">Labels</Text>
        <Stack direction={'row'} gap={1}>
          <Text variant="bodySmall" color="secondary">
            Add labels to your rule for searching, silencing, or routing to a notification policy.
          </Text>
          <NeedHelpInfo
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
            <Button icon="plus" type="button" variant="secondary" onClick={onEditClick} size="sm">
              Add labels
            </Button>
          </Stack>
        )}
      </Stack>
    </Stack>
  );
}
