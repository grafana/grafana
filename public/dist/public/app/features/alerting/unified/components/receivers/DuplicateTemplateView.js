import React from 'react';
import { Alert } from '@grafana/ui';
import { generateCopiedName } from '../../utils/duplicate';
import { updateDefinesWithUniqueValue } from '../../utils/templates';
import { TemplateForm } from './TemplateForm';
export const DuplicateTemplateView = ({ config, templateName, alertManagerSourceName }) => {
    var _a;
    const template = (_a = config.template_files) === null || _a === void 0 ? void 0 : _a[templateName];
    if (!template) {
        return (React.createElement(Alert, { severity: "error", title: "Template not found" }, "Sorry, this template does not seem to exists."));
    }
    const duplicatedName = generateCopiedName(templateName, Object.keys(config.template_files));
    return (React.createElement(TemplateForm, { alertManagerSourceName: alertManagerSourceName, config: config, existing: { name: duplicatedName, content: updateDefinesWithUniqueValue(template) } }));
};
//# sourceMappingURL=DuplicateTemplateView.js.map