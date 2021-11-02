import React from 'react';
import LabelsField from './LabelsField';
import AnnotationsField from './AnnotationsField';
import { RuleEditorSection } from './RuleEditorSection';
import { useFormContext } from 'react-hook-form';
import { RuleFormType } from '../../types/rule-form';
export var DetailsStep = function () {
    var watch = useFormContext().watch;
    var type = watch('type');
    return (React.createElement(RuleEditorSection, { stepNo: type === RuleFormType.cloudRecording ? 3 : 4, title: type === RuleFormType.cloudRecording ? 'Add details for your recording rule' : 'Add details for your alert', description: type === RuleFormType.cloudRecording
            ? 'Add labels to help you better manage your rules'
            : 'Write a summary and add labels to help you better manage your alerts' },
        type !== RuleFormType.cloudRecording && React.createElement(AnnotationsField, null),
        React.createElement(LabelsField, null)));
};
//# sourceMappingURL=DetailsStep.js.map