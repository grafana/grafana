import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import { usePrevious } from 'react-use';
import { Button, DataLinkInput, stylesFactory, InlineField, InlineSwitch, InlineFieldRow, InlineLabel, Input, } from '@grafana/ui';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
const getStyles = stylesFactory(() => ({
    firstRow: css `
    display: flex;
  `,
    nameField: css `
    flex: 2;
  `,
    regexField: css `
    flex: 3;
  `,
    row: css `
    display: flex;
    align-items: baseline;
  `,
    urlField: css `
    display: flex;
    flex: 1;
  `,
    urlDisplayLabelField: css `
    flex: 1;
  `,
}));
export const DataLink = (props) => {
    const { value, onChange, onDelete, suggestions, className } = props;
    const styles = getStyles();
    const [showInternalLink, setShowInternalLink] = useInternalLink(value.datasourceUid);
    const handleChange = (field) => (event) => {
        onChange(Object.assign(Object.assign({}, value), { [field]: event.currentTarget.value }));
    };
    return (React.createElement("div", { className: className },
        React.createElement("div", { className: styles.firstRow },
            React.createElement(InlineField, { label: "Field", htmlFor: "elasticsearch-datasource-config-field", labelWidth: 12, tooltip: 'Can be exact field name or a regex pattern that will match on the field name.' },
                React.createElement(Input, { type: "text", id: "elasticsearch-datasource-config-field", value: value.field, onChange: handleChange('field'), width: 100 })),
            React.createElement(Button, { variant: 'destructive', title: "Remove field", icon: "times", onClick: (event) => {
                    event.preventDefault();
                    onDelete();
                } })),
        React.createElement(InlineFieldRow, null,
            React.createElement("div", { className: styles.urlField },
                React.createElement(InlineLabel, { htmlFor: "elasticsearch-datasource-internal-link", width: 12 }, showInternalLink ? 'Query' : 'URL'),
                React.createElement(DataLinkInput, { placeholder: showInternalLink ? '${__value.raw}' : 'http://example.com/${__value.raw}', value: value.url || '', onChange: (newValue) => onChange(Object.assign(Object.assign({}, value), { url: newValue })), suggestions: suggestions })),
            React.createElement("div", { className: styles.urlDisplayLabelField },
                React.createElement(InlineField, { label: "URL Label", htmlFor: "elasticsearch-datasource-url-label", labelWidth: 14, tooltip: 'Use to override the button label.' },
                    React.createElement(Input, { type: "text", id: "elasticsearch-datasource-url-label", value: value.urlDisplayLabel, onChange: handleChange('urlDisplayLabel') })))),
        React.createElement("div", { className: styles.row },
            React.createElement(InlineField, { label: "Internal link", labelWidth: 12 },
                React.createElement(InlineSwitch, { label: "Internal link", value: showInternalLink || false, onChange: () => {
                        if (showInternalLink) {
                            onChange(Object.assign(Object.assign({}, value), { datasourceUid: undefined }));
                        }
                        setShowInternalLink(!showInternalLink);
                    } })),
            showInternalLink && (React.createElement(DataSourcePicker, { tracing: true, 
                // Uid and value should be always set in the db and so in the items.
                onChange: (ds) => {
                    onChange(Object.assign(Object.assign({}, value), { datasourceUid: ds.uid }));
                }, current: value.datasourceUid })))));
};
function useInternalLink(datasourceUid) {
    const [showInternalLink, setShowInternalLink] = useState(!!datasourceUid);
    const previousUid = usePrevious(datasourceUid);
    // Force internal link visibility change if uid changed outside of this component.
    useEffect(() => {
        if (!previousUid && datasourceUid && !showInternalLink) {
            setShowInternalLink(true);
        }
        if (previousUid && !datasourceUid && showInternalLink) {
            setShowInternalLink(false);
        }
    }, [previousUid, datasourceUid, showInternalLink]);
    return [showInternalLink, setShowInternalLink];
}
//# sourceMappingURL=DataLink.js.map