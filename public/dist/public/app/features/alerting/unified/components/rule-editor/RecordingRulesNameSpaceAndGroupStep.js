import React from 'react';
import { useFormContext } from 'react-hook-form';
import { GroupAndNamespaceFields } from './GroupAndNamespaceFields';
import { RuleEditorSection } from './RuleEditorSection';
export function RecordingRulesNameSpaceAndGroupStep() {
    const { watch } = useFormContext();
    const dataSourceName = watch('dataSourceName');
    if (!dataSourceName) {
        return null;
    }
    return (React.createElement(RuleEditorSection, { stepNo: 3, title: 'Add namespace and group', description: "Select the Namespace and Group for your recording rule." },
        React.createElement(GroupAndNamespaceFields, { rulesSourceName: dataSourceName })));
}
//# sourceMappingURL=RecordingRulesNameSpaceAndGroupStep.js.map