import { css } from '@emotion/css';
import React from 'react';
import { VariableOrigin, DataLinkBuiltInVars } from '@grafana/data';
import { ConfigSubSection } from '@grafana/experimental';
import { Button, useStyles2 } from '@grafana/ui';
import { ConfigDescriptionLink } from 'app/core/components/ConfigDescriptionLink';
import { DataLink } from './DataLink';
const getStyles = (theme) => {
    return {
        addButton: css `
      margin-right: 10px;
    `,
        container: css `
      margin-bottom: ${theme.spacing(2)};
    `,
        dataLink: css `
      margin-bottom: ${theme.spacing(1)};
    `,
    };
};
export const DataLinks = (props) => {
    const { value, onChange } = props;
    const styles = useStyles2(getStyles);
    return (React.createElement(ConfigSubSection, { title: "Data links", description: React.createElement(ConfigDescriptionLink, { description: "Add links to existing fields. Links will be shown in log row details next to the field value.", suffix: "elasticsearch/#data-links", feature: "Elasticsearch data links" }) },
        React.createElement("div", { className: styles.container },
            value && value.length > 0 && (React.createElement("div", { className: "gf-form-group" }, value.map((field, index) => {
                return (React.createElement(DataLink, { className: styles.dataLink, key: index, value: field, onChange: (newField) => {
                        const newDataLinks = [...value];
                        newDataLinks.splice(index, 1, newField);
                        onChange(newDataLinks);
                    }, onDelete: () => {
                        const newDataLinks = [...value];
                        newDataLinks.splice(index, 1);
                        onChange(newDataLinks);
                    }, suggestions: [
                        {
                            value: DataLinkBuiltInVars.valueRaw,
                            label: 'Raw value',
                            documentation: 'Raw value of the field',
                            origin: VariableOrigin.Value,
                        },
                    ] }));
            }))),
            React.createElement(Button, { type: "button", variant: 'secondary', className: styles.addButton, icon: "plus", onClick: (event) => {
                    event.preventDefault();
                    const newDataLinks = [...(value || []), { field: '', url: '' }];
                    onChange(newDataLinks);
                } }, "Add"))));
};
//# sourceMappingURL=DataLinks.js.map