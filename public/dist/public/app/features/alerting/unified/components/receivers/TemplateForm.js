import { __assign, __makeTemplateObject, __read, __spreadArray } from "tslib";
import { css } from '@emotion/css';
import { Alert, Button, Field, Input, LinkButton, TextArea, useStyles2 } from '@grafana/ui';
import { useCleanup } from 'app/core/hooks/useCleanup';
import React from 'react';
import { useForm } from 'react-hook-form';
import { useDispatch } from 'react-redux';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { updateAlertManagerConfigAction } from '../../state/actions';
import { makeAMLink } from '../../utils/misc';
import { ensureDefine } from '../../utils/templates';
var defaults = Object.freeze({
    name: '',
    content: '',
});
export var TemplateForm = function (_a) {
    var _b, _c, _d, _e, _f, _g;
    var existing = _a.existing, alertManagerSourceName = _a.alertManagerSourceName, config = _a.config;
    var styles = useStyles2(getStyles);
    var dispatch = useDispatch();
    useCleanup(function (state) { return state.unifiedAlerting.saveAMConfig; });
    var _h = useUnifiedAlertingSelector(function (state) { return state.saveAMConfig; }), loading = _h.loading, error = _h.error;
    var submit = function (values) {
        var _a;
        var _b;
        // wrap content in "define" if it's not already wrapped, in case user did not do it/
        // it's not obvious that this is needed for template to work
        var content = ensureDefine(values.name, values.content);
        // add new template to template map
        var template_files = __assign(__assign({}, config.template_files), (_a = {}, _a[values.name] = content, _a));
        // delete existing one (if name changed, otherwise it was overwritten in previous step)
        if (existing && existing.name !== values.name) {
            delete template_files[existing.name];
        }
        // make sure name for the template is configured on the alertmanager config object
        var templates = __spreadArray(__spreadArray([], __read(((_b = config.alertmanager_config.templates) !== null && _b !== void 0 ? _b : []).filter(function (name) { return name !== (existing === null || existing === void 0 ? void 0 : existing.name); })), false), [
            values.name,
        ], false);
        var newConfig = {
            template_files: template_files,
            alertmanager_config: __assign(__assign({}, config.alertmanager_config), { templates: templates }),
        };
        dispatch(updateAlertManagerConfigAction({
            alertManagerSourceName: alertManagerSourceName,
            newConfig: newConfig,
            oldConfig: config,
            successMessage: 'Template saved.',
            redirectPath: '/alerting/notifications',
        }));
    };
    var _j = useForm({
        mode: 'onSubmit',
        defaultValues: existing !== null && existing !== void 0 ? existing : defaults,
    }), handleSubmit = _j.handleSubmit, register = _j.register, errors = _j.formState.errors;
    var validateNameIsUnique = function (name) {
        return !config.template_files[name] || (existing === null || existing === void 0 ? void 0 : existing.name) === name
            ? true
            : 'Another template with this name already exists.';
    };
    return (React.createElement("form", { onSubmit: handleSubmit(submit) },
        React.createElement("h4", null, existing ? 'Edit message template' : 'Create message template'),
        error && (React.createElement(Alert, { severity: "error", title: "Error saving template" }, error.message || ((_c = (_b = error) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.message) || String(error))),
        React.createElement(Field, { label: "Template name", error: (_d = errors === null || errors === void 0 ? void 0 : errors.name) === null || _d === void 0 ? void 0 : _d.message, invalid: !!((_e = errors.name) === null || _e === void 0 ? void 0 : _e.message), required: true },
            React.createElement(Input, __assign({}, register('name', {
                required: { value: true, message: 'Required.' },
                validate: { nameIsUnique: validateNameIsUnique },
            }), { placeholder: "Give your template a name", width: 42, autoFocus: true }))),
        React.createElement(Field, { description: React.createElement(React.Fragment, null,
                "You can use the",
                ' ',
                React.createElement("a", { href: "https://pkg.go.dev/text/template?utm_source=godoc", target: "__blank", rel: "noreferrer", className: styles.externalLink }, "Go templating language"),
                ".",
                ' ',
                React.createElement("a", { href: "https://prometheus.io/blog/2016/03/03/custom-alertmanager-templates/", target: "__blank", rel: "noreferrer", className: styles.externalLink }, "More info about alertmanager templates")), label: "Content", error: (_f = errors === null || errors === void 0 ? void 0 : errors.content) === null || _f === void 0 ? void 0 : _f.message, invalid: !!((_g = errors.content) === null || _g === void 0 ? void 0 : _g.message), required: true },
            React.createElement(TextArea, __assign({}, register('content', { required: { value: true, message: 'Required.' } }), { className: styles.textarea, placeholder: "Message", rows: 12 }))),
        React.createElement("div", { className: styles.buttons },
            loading && (React.createElement(Button, { disabled: true, icon: "fa fa-spinner", variant: "primary" }, "Saving...")),
            !loading && React.createElement(Button, { variant: "primary" }, "Save template"),
            React.createElement(LinkButton, { disabled: loading, href: makeAMLink('alerting/notifications', alertManagerSourceName), variant: "secondary", type: "button", fill: "outline" }, "Cancel"))));
};
var getStyles = function (theme) { return ({
    externalLink: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    color: ", ";\n    text-decoration: underline;\n  "], ["\n    color: ", ";\n    text-decoration: underline;\n  "])), theme.colors.text.secondary),
    buttons: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    & > * + * {\n      margin-left: ", ";\n    }\n  "], ["\n    & > * + * {\n      margin-left: ", ";\n    }\n  "])), theme.spacing(1)),
    textarea: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    max-width: 758px;\n  "], ["\n    max-width: 758px;\n  "]))),
}); };
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=TemplateForm.js.map