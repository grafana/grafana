import { css } from '@emotion/css';
import React from 'react';
import { useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Badge, Button, Icon, Stack, Text, useStyles2 } from '@grafana/ui';

import { RuleFormValues } from '../../../types/rule-form';
import { NeedHelpInfo } from '../NeedHelpInfo';

import { LabelsInRule } from './LabelsField';

interface LabelsFieldInFormProps {
  onEditClick: () => void;
}
export function LabelsFieldInForm({ onEditClick }: LabelsFieldInFormProps) {
  const styles = useStyles2(getStyles);
  const { watch } = useFormContext<RuleFormValues>();
  const labels = watch('labels');
  const hasLabels = Object.keys(labels).length > 0 && labels.some((label) => label.key || label.value);

  return (
    <div>
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
      <div className={styles.labelsContainer}></div>
      <Stack direction="row" gap={1} alignItems="center">
        <LabelsInRule />
        {hasLabels ? (
          <Icon name={'pen'} onClick={onEditClick} className={styles.editIcon} />
        ) : (
          <Stack direction="row" gap={1}>
            <Badge color="orange" text=" No labels selected " />
            <Button icon="plus" type="button" variant="secondary" onClick={onEditClick}>
              Add labels
            </Button>
          </Stack>
        )}
      </Stack>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    labelsContainer: css({
      marginBottom: theme.spacing(3),
    }),
    editIcon: css({
      cursor: 'pointer',
    }),
  };
};
