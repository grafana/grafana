import { css } from '@emotion/css';
import React, { useCallback, useState } from 'react';
import { VariableOrigin, DataLinkBuiltInVars } from '@grafana/data';
import { ConfigSubSection } from '@grafana/experimental';
import { Button, useTheme2 } from '@grafana/ui';
import { ConfigDescriptionLink } from 'app/core/components/ConfigDescriptionLink';
import { DebugSection } from './DebugSection';
import { DerivedField } from './DerivedField';
const getStyles = (theme) => ({
    addButton: css `
    margin-right: 10px;
  `,
    derivedField: css `
    margin-bottom: ${theme.spacing(1)};
  `,
    container: css `
    margin-bottom: ${theme.spacing(4)};
  `,
    debugSection: css `
    margin-top: ${theme.spacing(4)};
  `,
});
export const DerivedFields = ({ fields = [], onChange }) => {
    const theme = useTheme2();
    const styles = getStyles(theme);
    const [showDebug, setShowDebug] = useState(false);
    const validateName = useCallback((name) => {
        return fields.filter((field) => field.name && field.name === name).length <= 1;
    }, [fields]);
    return (React.createElement(ConfigSubSection, { title: "Derived fields", description: React.createElement(ConfigDescriptionLink, { description: "Derived fields can be used to extract new fields from a log message and create a link from its value.", suffix: "loki/configure-loki-data-source/#derived-fields", feature: "derived fields" }) },
        React.createElement("div", { className: styles.container },
            fields.map((field, index) => {
                return (React.createElement(DerivedField, { className: styles.derivedField, key: index, value: field, onChange: (newField) => {
                        const newDerivedFields = [...fields];
                        newDerivedFields.splice(index, 1, newField);
                        onChange(newDerivedFields);
                    }, onDelete: () => {
                        const newDerivedFields = [...fields];
                        newDerivedFields.splice(index, 1);
                        onChange(newDerivedFields);
                    }, validateName: validateName, suggestions: [
                        {
                            value: DataLinkBuiltInVars.valueRaw,
                            label: 'Raw value',
                            documentation: 'Exact string captured by the regular expression',
                            origin: VariableOrigin.Value,
                        },
                    ] }));
            }),
            React.createElement("div", null,
                React.createElement(Button, { variant: "secondary", className: styles.addButton, icon: "plus", onClick: (event) => {
                        event.preventDefault();
                        const newDerivedFields = [...fields, { name: '', matcherRegex: '', urlDisplayLabel: '', url: '' }];
                        onChange(newDerivedFields);
                    } }, "Add"),
                fields.length > 0 && (React.createElement(Button, { variant: "secondary", type: "button", onClick: () => setShowDebug(!showDebug) }, showDebug ? 'Hide example log message' : 'Show example log message'))),
            showDebug && (React.createElement("div", { className: styles.debugSection },
                React.createElement(DebugSection, { className: css `
                margin-bottom: 10px;
              `, derivedFields: fields }))))));
};
//# sourceMappingURL=DerivedFields.js.map