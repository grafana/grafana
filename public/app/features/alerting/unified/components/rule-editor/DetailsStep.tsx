import React from 'react';
import { useFormContext } from 'react-hook-form';

import { RuleFormType, RuleFormValues } from '../../types/rule-form';

import AnnotationsField from './AnnotationsField';
import { GroupAndNamespaceFields } from './GroupAndNamespaceFields';
import { RuleEditorSection } from './RuleEditorSection';

export function DetailsStep() {
  const { watch } = useFormContext<RuleFormValues & { location?: string }>();

  const ruleFormType = watch('type');
  const dataSourceName = watch('dataSourceName');
  const type = watch('type');

  return (
    <RuleEditorSection
      stepNo={type === RuleFormType.cloudRecording ? 3 : 4}
      title={type === RuleFormType.cloudRecording ? 'Folder and group' : 'Add details for your alert rule'}
      description={
        type === RuleFormType.cloudRecording
          ? 'Select the Namespace and Group for your recording rule'
          : 'Select the folder and evaluation group for your alert. Write a summary to help you better manage your alerts'
      }
    >
      {(ruleFormType === RuleFormType.cloudRecording || ruleFormType === RuleFormType.cloudAlerting) &&
        dataSourceName && <GroupAndNamespaceFields rulesSourceName={dataSourceName} />}

      {type !== RuleFormType.cloudRecording && <AnnotationsField />}
    </RuleEditorSection>
  );
}
