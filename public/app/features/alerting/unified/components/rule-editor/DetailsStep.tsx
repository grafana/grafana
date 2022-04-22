import React, { FC } from 'react';
import { useFormContext } from 'react-hook-form';

import { RuleFormType, RuleFormValues } from '../../types/rule-form';

import AnnotationsField from './AnnotationsField';
import LabelsField from './LabelsField';
import { RuleEditorSection } from './RuleEditorSection';

export const DetailsStep: FC = () => {
  const { watch } = useFormContext<RuleFormValues>();

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
      {type !== RuleFormType.cloudRecording && <AnnotationsField />}
      <LabelsField />
    </RuleEditorSection>
  );
};
