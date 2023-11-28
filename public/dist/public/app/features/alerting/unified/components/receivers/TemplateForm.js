import { css } from '@emotion/css';
import { subDays } from 'date-fns';
import React, { useCallback, useEffect, useState } from 'react';
import { FormProvider, useForm, useFormContext } from 'react-hook-form';
import { useLocation } from 'react-router-dom';
import AutoSizer from 'react-virtualized-auto-sizer';
import { Stack } from '@grafana/experimental';
import { isFetchError } from '@grafana/runtime';
import { Alert, Button, CollapsableSection, Field, FieldSet, Input, LinkButton, Spinner, Tab, TabsBar, useStyles2, } from '@grafana/ui';
import { useCleanup } from 'app/core/hooks/useCleanup';
import { useDispatch } from 'app/types';
import { usePreviewTemplateMutation, } from '../../api/templateApi';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { updateAlertManagerConfigAction } from '../../state/actions';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { makeAMLink } from '../../utils/misc';
import { initialAsyncRequestState } from '../../utils/redux';
import { ensureDefine } from '../../utils/templates';
import { ProvisionedResource, ProvisioningAlert } from '../Provisioning';
import { PayloadEditor } from './PayloadEditor';
import { TemplateDataDocs } from './TemplateDataDocs';
import { TemplateEditor } from './TemplateEditor';
import { snippets } from './editor/templateDataSuggestions';
export const defaults = Object.freeze({
    name: '',
    content: '',
});
export const isDuplicating = (location) => location.pathname.endsWith('/duplicate');
const DEFAULT_PAYLOAD = `[
  {
    "annotations": {
      "summary": "Instance instance1 has been down for more than 5 minutes"
    },
    "labels": {
      "instance": "instance1"
    },
    "startsAt": "${subDays(new Date(), 1).toISOString()}"
  }]
`;
export const TemplateForm = ({ existing, alertManagerSourceName, config, provenance }) => {
    var _a, _b, _c;
    const styles = useStyles2(getStyles);
    const dispatch = useDispatch();
    useCleanup((state) => (state.unifiedAlerting.saveAMConfig = initialAsyncRequestState));
    const { loading, error } = useUnifiedAlertingSelector((state) => state.saveAMConfig);
    const location = useLocation();
    const isduplicating = isDuplicating(location);
    const [payload, setPayload] = useState(DEFAULT_PAYLOAD);
    const [payloadFormatError, setPayloadFormatError] = useState(null);
    const [view, setView] = useState('content');
    const onPayloadError = () => setView('preview');
    const submit = (values) => {
        var _a;
        // wrap content in "define" if it's not already wrapped, in case user did not do it/
        // it's not obvious that this is needed for template to work
        const content = ensureDefine(values.name, values.content);
        // add new template to template map
        const template_files = Object.assign(Object.assign({}, config.template_files), { [values.name]: content });
        // delete existing one (if name changed, otherwise it was overwritten in previous step)
        if (existing && existing.name !== values.name) {
            delete template_files[existing.name];
        }
        // make sure name for the template is configured on the alertmanager config object
        const templates = [
            ...((_a = config.alertmanager_config.templates) !== null && _a !== void 0 ? _a : []).filter((name) => name !== (existing === null || existing === void 0 ? void 0 : existing.name)),
            values.name,
        ];
        const newConfig = {
            template_files,
            alertmanager_config: Object.assign(Object.assign({}, config.alertmanager_config), { templates }),
        };
        dispatch(updateAlertManagerConfigAction({
            alertManagerSourceName,
            newConfig,
            oldConfig: config,
            successMessage: 'Template saved.',
            redirectPath: '/alerting/notifications',
        }));
    };
    const formApi = useForm({
        mode: 'onSubmit',
        defaultValues: existing !== null && existing !== void 0 ? existing : defaults,
    });
    const { handleSubmit, register, formState: { errors }, getValues, setValue, watch, } = formApi;
    const validateNameIsUnique = (name) => {
        return !config.template_files[name] || (existing === null || existing === void 0 ? void 0 : existing.name) === name
            ? true
            : 'Another template with this name already exists.';
    };
    const isGrafanaAlertManager = alertManagerSourceName === GRAFANA_RULES_SOURCE_NAME;
    return (React.createElement(FormProvider, Object.assign({}, formApi),
        React.createElement("form", { onSubmit: handleSubmit(submit) },
            React.createElement("h4", null, existing && !isduplicating ? 'Edit notification template' : 'Create notification template'),
            error && (React.createElement(Alert, { severity: "error", title: "Error saving template" }, error.message || (isFetchError(error) && ((_a = error.data) === null || _a === void 0 ? void 0 : _a.message)) || String(error))),
            provenance && React.createElement(ProvisioningAlert, { resource: ProvisionedResource.Template }),
            React.createElement(FieldSet, { disabled: Boolean(provenance) },
                React.createElement(Field, { label: "Template name", error: (_b = errors === null || errors === void 0 ? void 0 : errors.name) === null || _b === void 0 ? void 0 : _b.message, invalid: !!((_c = errors.name) === null || _c === void 0 ? void 0 : _c.message), required: true },
                    React.createElement(Input, Object.assign({}, register('name', {
                        required: { value: true, message: 'Required.' },
                        validate: { nameIsUnique: validateNameIsUnique },
                    }), { placeholder: "Give your template a name", width: 42, autoFocus: true }))),
                React.createElement(TemplatingGuideline, null),
                React.createElement("div", { className: styles.editorsWrapper },
                    React.createElement("div", { className: styles.contentContainer },
                        React.createElement(TabsBar, null,
                            React.createElement(Tab, { label: "Content", active: view === 'content', onChangeTab: () => setView('content') }),
                            isGrafanaAlertManager && (React.createElement(Tab, { label: "Preview", active: view === 'preview', onChangeTab: () => setView('preview') }))),
                        React.createElement("div", { className: styles.contentContainerEditor },
                            React.createElement(AutoSizer, null, ({ width }) => {
                                var _a, _b;
                                return (React.createElement(React.Fragment, null, view === 'content' ? (React.createElement("div", null,
                                    React.createElement(Field, { error: (_a = errors === null || errors === void 0 ? void 0 : errors.content) === null || _a === void 0 ? void 0 : _a.message, invalid: !!((_b = errors.content) === null || _b === void 0 ? void 0 : _b.message), required: true },
                                        React.createElement("div", { className: styles.editWrapper },
                                            React.createElement(TemplateEditor, { value: getValues('content'), width: width, height: 363, onBlur: (value) => setValue('content', value) }))),
                                    React.createElement("div", { className: styles.buttons },
                                        loading && (React.createElement(Button, { disabled: true, icon: "fa fa-spinner", variant: "primary" }, "Saving...")),
                                        !loading && (React.createElement(Button, { type: "submit", variant: "primary" }, "Save template")),
                                        React.createElement(LinkButton, { disabled: loading, href: makeAMLink('alerting/notifications', alertManagerSourceName), variant: "secondary", type: "button" }, "Cancel")))) : (React.createElement(TemplatePreview, { width: width, payload: payload, templateName: watch('name'), setPayloadFormatError: setPayloadFormatError, payloadFormatError: payloadFormatError }))));
                            }))),
                    isGrafanaAlertManager && (React.createElement(PayloadEditor, { payload: payload, setPayload: setPayload, defaultPayload: DEFAULT_PAYLOAD, setPayloadFormatError: setPayloadFormatError, payloadFormatError: payloadFormatError, onPayloadError: onPayloadError })))),
            React.createElement(CollapsableSection, { label: "Data cheat sheet", isOpen: false, className: styles.collapsableSection },
                React.createElement(TemplateDataDocs, null)))));
};
function TemplatingGuideline() {
    const styles = useStyles2(getStyles);
    return (React.createElement(Alert, { title: "Templating guideline", severity: "info" },
        React.createElement(Stack, { direction: "row" },
            React.createElement("div", null,
                "Grafana uses Go templating language to create notification messages.",
                React.createElement("br", null),
                "To find out more about templating please visit our documentation."),
            React.createElement("div", null,
                React.createElement(LinkButton, { href: "https://grafana.com/docs/grafana/latest/alerting/manage-notifications/template-notifications/", target: "_blank", icon: "external-link-alt", variant: "secondary" }, "Templating documentation"))),
        React.createElement("div", { className: styles.snippets },
            "To make templating easier, we provide a few snippets in the content editor to help you speed up your workflow.",
            React.createElement("div", { className: styles.code }, Object.values(snippets)
                .map((s) => s.label)
                .join(', ')))));
}
function getResultsToRender(results) {
    const filteredResults = results.filter((result) => result.text.trim().length > 0);
    const moreThanOne = filteredResults.length > 1;
    const preview = (result) => {
        const previewForLabel = `Preview for ${result.name}:`;
        const separatorStart = '='.repeat(previewForLabel.length).concat('>');
        const separatorEnd = '<'.concat('='.repeat(previewForLabel.length));
        if (moreThanOne) {
            return `${previewForLabel}\n${separatorStart}${result.text}${separatorEnd}\n`;
        }
        else {
            return `${separatorStart}${result.text}${separatorEnd}\n`;
        }
    };
    return filteredResults
        .map((result) => {
        return preview(result);
    })
        .join(`\n`);
}
function getErrorsToRender(results) {
    return results
        .map((result) => {
        if (result.name) {
            return `ERROR in ${result.name}:\n`.concat(`${result.kind}\n${result.message}\n`);
        }
        else {
            return `ERROR:\n${result.kind}\n${result.message}\n`;
        }
    })
        .join(`\n`);
}
export const PREVIEW_NOT_AVAILABLE = 'Preview request failed. Check if the payload data has the correct structure.';
function getPreviewTorender(isPreviewError, payloadFormatError, data) {
    // ERRORS IN JSON OR IN REQUEST (endpoint not available, for example)
    const previewErrorRequest = isPreviewError ? PREVIEW_NOT_AVAILABLE : undefined;
    const somethingWasWrong = isPreviewError || Boolean(payloadFormatError);
    const errorToRender = payloadFormatError || previewErrorRequest;
    //PREVIEW : RESULTS AND ERRORS
    const previewResponseResults = data === null || data === void 0 ? void 0 : data.results;
    const previewResponseErrors = data === null || data === void 0 ? void 0 : data.errors;
    const previewResultsToRender = previewResponseResults ? getResultsToRender(previewResponseResults) : '';
    const previewErrorsToRender = previewResponseErrors ? getErrorsToRender(previewResponseErrors) : '';
    if (somethingWasWrong) {
        return errorToRender;
    }
    else {
        return `${previewResultsToRender}\n${previewErrorsToRender}`;
    }
}
export function TemplatePreview({ payload, templateName, payloadFormatError, setPayloadFormatError, width, }) {
    const styles = useStyles2(getStyles);
    const { watch } = useFormContext();
    const templateContent = watch('content');
    const [trigger, { data, isError: isPreviewError, isLoading }] = usePreviewTemplateMutation();
    const previewToRender = getPreviewTorender(isPreviewError, payloadFormatError, data);
    const onPreview = useCallback(() => {
        try {
            const alertList = JSON.parse(payload);
            JSON.stringify([...alertList]); // check if it's iterable, in order to be able to add more data
            trigger({ template: templateContent, alerts: alertList, name: templateName });
            setPayloadFormatError(null);
        }
        catch (e) {
            setPayloadFormatError(e instanceof Error ? e.message : 'Invalid JSON.');
        }
    }, [templateContent, templateName, payload, setPayloadFormatError, trigger]);
    useEffect(() => onPreview(), [onPreview]);
    return (React.createElement("div", { style: { width: `${width}px` }, className: styles.preview.wrapper },
        isLoading && (React.createElement(React.Fragment, null,
            React.createElement(Spinner, { inline: true }),
            " Loading preview...")),
        React.createElement("pre", { className: styles.preview.result, "data-testid": "payloadJSON" }, previewToRender),
        React.createElement(Button, { onClick: onPreview, className: styles.preview.button, icon: "arrow-up", type: "button", variant: "secondary" }, "Refresh preview")));
}
const getStyles = (theme) => ({
    contentContainer: css `
    flex: 1;
    margin-bottom: ${theme.spacing(6)};
  `,
    contentContainerEditor: css `
      flex:1;
      display: flex;
      padding-top: 10px;
      gap: ${theme.spacing(2)};
      flex-direction: row;
      align-items: flex-start;
      flex-wrap: wrap;
      ${theme.breakpoints.up('xxl')} {
        flex - wrap: nowrap;
    }
      min-width: 450px;
      height: 363px;
      `,
    snippets: css `
    margin-top: ${theme.spacing(2)};
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
    code: css `
    color: ${theme.colors.text.secondary};
    font-weight: ${theme.typography.fontWeightBold};
  `,
    buttons: css `
    display: flex;
    & > * + * {
      margin-left: ${theme.spacing(1)};
    }
    margin-top: -7px;
  `,
    textarea: css `
    max-width: 758px;
  `,
    editWrapper: css `
      display: flex;
      width: 100%
      heigth:100%;
      position: relative;
      `,
    toggle: css `
      color: theme.colors.text.secondary,
      marginRight: ${theme.spacing(1)}`,
    preview: {
        wrapper: css `
      display: flex;
      width: 100%
      heigth:100%;
      position: relative;
      flex-direction: column;
      `,
        result: css `
      width: 100%;
      height: 363px;
    `,
        button: css `
      flex: none;
      width: fit-content;
      margin-top: -6px;
    `,
    },
    collapsableSection: css `
    width: fit-content;
  `,
    editorsWrapper: css `
    display: flex;
    flex: 1;
    flex-wrap: wrap;
    gap: ${theme.spacing(1)};
  `,
});
//# sourceMappingURL=TemplateForm.js.map