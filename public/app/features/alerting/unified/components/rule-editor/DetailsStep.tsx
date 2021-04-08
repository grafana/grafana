import React, { FC } from 'react';
import LabelsField from './LabelsField';
import AnnotationsField from './AnnotationsField';
import { RuleEditorSection } from './RuleEditorSection';

export const DetailsStep: FC = () => {
  return (
    <RuleEditorSection stepNo={4} title="Add details for your alert">
      <AnnotationsField />
      <LabelsField />
    </RuleEditorSection>
  );
};
