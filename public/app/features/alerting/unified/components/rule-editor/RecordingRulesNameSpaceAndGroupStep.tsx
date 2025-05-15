import { useFormContext } from 'react-hook-form';

import { useTranslate } from '@grafana/i18n';

import { RuleFormValues } from '../../types/rule-form';

import { GroupAndNamespaceFields } from './GroupAndNamespaceFields';
import { RuleEditorSection } from './RuleEditorSection';

export function RecordingRulesNameSpaceAndGroupStep() {
  const { watch } = useFormContext<RuleFormValues>();
  const { t } = useTranslate();
  const dataSourceName = watch('dataSourceName');

  if (!dataSourceName) {
    return null;
  }

  return (
    <RuleEditorSection
      stepNo={3}
      title={t(
        'alerting.recording-rules-name-space-and-group-step.title-add-namespace-and-group',
        'Add namespace and group'
      )}
      description={t(
        'alerting.recording-rules-name-space-and-group-step.description-select-namespace-group-recording',
        'Select the Namespace and Group for your recording rule.'
      )}
    >
      <GroupAndNamespaceFields rulesSourceName={dataSourceName} />
    </RuleEditorSection>
  );
}
