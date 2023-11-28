import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import { usePrevious } from 'react-use';
import { Button, DataLinkInput, Field, Icon, Input, Label, Tooltip, useStyles2, Switch } from '@grafana/ui';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
const getStyles = (theme) => ({
    row: css `
    display: flex;
    align-items: baseline;
  `,
    nameField: css `
    flex: 2;
    margin-right: ${theme.spacing(0.5)};
  `,
    regexField: css `
    flex: 3;
    margin-right: ${theme.spacing(0.5)};
  `,
    urlField: css `
    flex: 1;
    margin-right: ${theme.spacing(0.5)};
  `,
    urlDisplayLabelField: css `
    flex: 1;
  `,
    internalLink: css `
    margin-right: ${theme.spacing(1)};
  `,
    dataSource: css ``,
});
export const DerivedField = (props) => {
    const { value, onChange, onDelete, suggestions, className, validateName } = props;
    const styles = useStyles2(getStyles);
    const [showInternalLink, setShowInternalLink] = useState(!!value.datasourceUid);
    const previousUid = usePrevious(value.datasourceUid);
    // Force internal link visibility change if uid changed outside of this component.
    useEffect(() => {
        if (!previousUid && value.datasourceUid && !showInternalLink) {
            setShowInternalLink(true);
        }
        if (previousUid && !value.datasourceUid && showInternalLink) {
            setShowInternalLink(false);
        }
    }, [previousUid, value.datasourceUid, showInternalLink]);
    const handleChange = (field) => (event) => {
        onChange(Object.assign(Object.assign({}, value), { [field]: event.currentTarget.value }));
    };
    const invalidName = !validateName(value.name);
    return (React.createElement("div", { className: className, "data-testid": "derived-field" },
        React.createElement("div", { className: "gf-form" },
            React.createElement(Field, { className: styles.nameField, label: "Name", invalid: invalidName, error: "The name is already in use" },
                React.createElement(Input, { value: value.name, onChange: handleChange('name'), placeholder: "Field name", invalid: invalidName })),
            React.createElement(Field, { className: styles.regexField, label: React.createElement(TooltipLabel, { label: "Regex", content: "Use to parse and capture some part of the log message. You can use the captured groups in the template." }) },
                React.createElement(Input, { value: value.matcherRegex, onChange: handleChange('matcherRegex') })),
            React.createElement(Field, { label: "" },
                React.createElement(Button, { variant: "destructive", title: "Remove field", icon: "times", onClick: (event) => {
                        event.preventDefault();
                        onDelete();
                    } }))),
        React.createElement("div", { className: "gf-form" },
            React.createElement(Field, { label: showInternalLink ? 'Query' : 'URL', className: styles.urlField },
                React.createElement(DataLinkInput, { placeholder: showInternalLink ? '${__value.raw}' : 'http://example.com/${__value.raw}', value: value.url || '', onChange: (newValue) => onChange(Object.assign(Object.assign({}, value), { url: newValue })), suggestions: suggestions })),
            React.createElement(Field, { className: styles.urlDisplayLabelField, label: React.createElement(TooltipLabel, { label: "URL Label", content: "Use to override the button label when this derived field is found in a log." }) },
                React.createElement(Input, { value: value.urlDisplayLabel, onChange: handleChange('urlDisplayLabel') }))),
        React.createElement("div", { className: "gf-form" },
            React.createElement(Field, { label: "Internal link", className: styles.internalLink },
                React.createElement(Switch, { value: showInternalLink, onChange: (e) => {
                        const { checked } = e.currentTarget;
                        if (!checked) {
                            onChange(Object.assign(Object.assign({}, value), { datasourceUid: undefined }));
                        }
                        setShowInternalLink(checked);
                    } })),
            showInternalLink && (React.createElement(Field, { label: "", className: styles.dataSource },
                React.createElement(DataSourcePicker, { tracing: true, onChange: (ds) => onChange(Object.assign(Object.assign({}, value), { datasourceUid: ds.uid })), current: value.datasourceUid, noDefault: true }))))));
};
const TooltipLabel = ({ content, label }) => (React.createElement(Label, null,
    label,
    React.createElement(Tooltip, { placement: "top", content: content, theme: "info" },
        React.createElement(Icon, { tabIndex: 0, name: "info-circle", size: "sm", style: { marginLeft: '10px' } }))));
//# sourceMappingURL=DerivedField.js.map