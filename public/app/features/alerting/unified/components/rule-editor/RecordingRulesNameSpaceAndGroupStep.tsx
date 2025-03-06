import { useFormContext } from 'react-hook-form';

import { t } from 'app/core/internationalization';

import { RuleFormValues } from '../../types/rule-form';

import { GroupAndNamespaceFields } from './GroupAndNamespaceFields';
import { RuleEditorSection } from './RuleEditorSection';

export function RecordingRulesNameSpaceAndGroupStep() {
  const { watch } = useFormContext<RuleFormValues>();

  const dataSourceName = watch('dataSourceName');

  if (!dataSourceName) {
    return null;
  }

  return (
    <RuleEditorSection
      stepNo={3}
      title={'Add namespace and group'}
      description={t(
        'alerting.recording-rules-name-space-and-group-step.description-select-namespace-group-recording',
        'Select the Namespace and Group for your recording rule.'
      )}
    >
      <GroupAndNamespaceFields rulesSourceName={dataSourceName} />
    </RuleEditorSection>
  );
}
