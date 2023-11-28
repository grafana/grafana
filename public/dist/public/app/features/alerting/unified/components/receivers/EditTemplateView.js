import React from 'react';
import { Alert } from '@grafana/ui';
import { TemplateForm } from './TemplateForm';
export const EditTemplateView = ({ config, templateName, alertManagerSourceName }) => {
    var _a, _b;
    const template = (_a = config.template_files) === null || _a === void 0 ? void 0 : _a[templateName];
    const provenance = (_b = config.template_file_provenances) === null || _b === void 0 ? void 0 : _b[templateName];
    if (!template) {
        return (React.createElement(Alert, { severity: "error", title: "Template not found" }, "Sorry, this template does not seem to exists."));
    }
    return (React.createElement(TemplateForm, { alertManagerSourceName: alertManagerSourceName, config: config, existing: { name: templateName, content: template }, provenance: provenance }));
};
//# sourceMappingURL=EditTemplateView.js.map