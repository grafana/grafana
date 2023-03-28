import React from 'react';
import { useFormContext } from 'react-hook-form';

import { RuleFormType, RuleFormValues } from '../../types/rule-form';

import AnnotationsField from './AnnotationsField';
import { GroupAndNamespaceFields } from './GroupAndNamespaceFields';
import { RuleEditorSection } from './RuleEditorSection';

function getDescription(ruleType: RuleFormType | undefined) {
  if (ruleType === RuleFormType.cloudRecording) {
    return 'Select the Namespace and Group for your recording rule.';
  }
  const docsLink =
    'https://grafana.com/docs/grafana/latest/alerting/fundamentals/annotation-label/variables-label-annotation/#the-values-variable';
  const LinkToDocs = () => (
    <span>
      Click{' '}
      <a href={docsLink} target="_blank" rel="noreferrer">
        here{' '}
      </a>
      for documentation on how to template annotations and labels.
    </span>
  );
  if (ruleType === RuleFormType.grafana) {
    return (
      <span>
        {' '}
        Write a summary to help you better manage your alerts.
        <LinkToDocs />
      </span>
    );
  }
  if (ruleType === RuleFormType.cloudAlerting) {
    return (
      <span>
        {' '}
        Select the Namespace and evaluation group for your alert. Write a summary to help you better manage your alerts.{' '}
        <LinkToDocs />
      </span>
    );
  }
  return '';
}

export function DetailsStep() {
  const { watch } = useFormContext<RuleFormValues & { location?: string }>();

  const ruleFormType = watch('type');
  const dataSourceName = watch('dataSourceName');
  const type = watch('type');

  return (
    <RuleEditorSection
      stepNo={type === RuleFormType.cloudRecording ? 3 : 4}
      title={type === RuleFormType.cloudRecording ? 'Folder and group' : 'Add details for your alert rule'}
      description={getDescription(type)}
    >
      {(ruleFormType === RuleFormType.cloudRecording || ruleFormType === RuleFormType.cloudAlerting) &&
        dataSourceName && <GroupAndNamespaceFields rulesSourceName={dataSourceName} />}

      {type !== RuleFormType.cloudRecording && <AnnotationsField />}
    </RuleEditorSection>
  );
}
