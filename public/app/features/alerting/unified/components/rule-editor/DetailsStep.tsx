import { css } from '@emotion/css';
import React from 'react';
import { useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Field, Input } from '@grafana/ui';

import { RuleFormType, RuleFormValues } from '../../types/rule-form';

import AnnotationsField from './AnnotationsField';
import { GroupAndNamespaceFields } from './GroupAndNamespaceFields';
import { RuleEditorSection } from './RuleEditorSection';
import { checkForPathSeparator } from './util';

<<<<<<< HEAD
interface DetailsStepProps {
  initialFolder: RuleForm | null;
}

export const DetailsStep = ({ initialFolder }: DetailsStepProps) => {
=======
const recordingRuleNameValidationPattern = {
  message:
    'Recording rule name must be valid metric name. It may only contain letters, numbers, and colons. It may not contain whitespace.',
  value: /^[a-zA-Z_:][a-zA-Z0-9_:]*$/,
};

export function DetailsStep() {
>>>>>>> feb800ed51 (Move folder and group fields to the evaluation section in the alert form)
  const {
    register,
    watch,
    formState: { errors },
  } = useFormContext<RuleFormValues & { location?: string }>();

  const styles = useStyles2(getStyles);

  const ruleFormType = watch('type');
  const dataSourceName = watch('dataSourceName');
  const type = watch('type');

  return (
    <RuleEditorSection
      stepNo={type === RuleFormType.cloudRecording ? 3 : 4}
      title={
        type === RuleFormType.cloudRecording ? 'Add details for your recording rule' : 'Add details for your alert'
      }
      description={
        type === RuleFormType.cloudRecording
          ? 'Add labels to help you better manage your rules'
          : 'Write a summary and add labels to help you better manage your alerts'
      }
    >
      {(ruleFormType === RuleFormType.cloudRecording || ruleFormType === RuleFormType.cloudAlerting) &&
        dataSourceName && <GroupAndNamespaceFields rulesSourceName={dataSourceName} />}

      {type !== RuleFormType.cloudRecording && <AnnotationsField />}
    </RuleEditorSection>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  formInput: css`
    width: 275px;

    & + & {
      margin-left: ${theme.spacing(3)};
    }
  `,
});
