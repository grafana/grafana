import React, { FC } from 'react';
import LabelsField from './LabelsField';
import AnnotationsField from './AnnotationsField';
import { RuleEditorSection } from './RuleEditorSection';

export const DetailsStep: FC = () => {
  return (
    <RuleEditorSection
      stepNo={4}
      title="Add details for your alert"
      description="Write a summary and add labels to help you better manage your alerts"
    >
      <AnnotationsField />
      <LabelsField />
    </RuleEditorSection>
  );
};
