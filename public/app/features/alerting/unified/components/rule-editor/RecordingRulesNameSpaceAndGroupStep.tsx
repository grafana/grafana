import { useFormContext } from 'react-hook-form';

import { RuleFormValues } from '../../types/rule-form';

import { GroupAndNamespaceFields } from './GroupAndNamespaceFields';
import { RuleEditorSection, RuleEditorSubSection } from './RuleEditorSection';

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
      description="Select the Namespace and Group for your recording rule."
    >
      <RuleEditorSubSection>
        <GroupAndNamespaceFields rulesSourceName={dataSourceName} />
      </RuleEditorSubSection>
    </RuleEditorSection>
  );
}
