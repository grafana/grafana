import { InfoBox } from '@grafana/ui';
import React from 'react';
import { TemplateForm } from './TemplateForm';
export var EditTemplateView = function (_a) {
    var _b;
    var config = _a.config, templateName = _a.templateName, alertManagerSourceName = _a.alertManagerSourceName;
    var template = (_b = config.template_files) === null || _b === void 0 ? void 0 : _b[templateName];
    if (!template) {
        return (React.createElement(InfoBox, { severity: "error", title: "Template not found" }, "Sorry, this template does not seem to exit."));
    }
    return (React.createElement(TemplateForm, { alertManagerSourceName: alertManagerSourceName, config: config, existing: { name: templateName, content: template } }));
};
//# sourceMappingURL=EditTemplateView.js.map