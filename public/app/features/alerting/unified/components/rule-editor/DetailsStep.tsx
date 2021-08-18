import React, { FC } from 'react';
import LabelsField from './LabelsField';
import AnnotationsField from './AnnotationsField';
import { RuleEditorSection } from './RuleEditorSection';
import { useFormContext } from 'react-hook-form';
import { RuleFormType, RuleFormValues } from '../../types/rule-form';

export const DetailsStep: FC = () => {
  const { watch } = useFormContext<RuleFormValues>();

  const type = watch('type');

  return (
    <RuleEditorSection
      stepNo={type === RuleFormType.cloudRecording ? 3 : 4}
      title="Add details for your alert"
      description="Write a summary and add labels to help you better manage your alerts"
    >
      {type !== RuleFormType.cloudRecording && <AnnotationsField />}
      <LabelsField />
    </RuleEditorSection>
  );
};
