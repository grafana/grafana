import { formattedValueToString, getFieldDisplayValuesProxy, getTimeField, } from '@grafana/data';
import { getLinkSrv } from './link_srv';
/**
 * Link suppliers creates link models based on a link origin
 */
export const getFieldLinksSupplier = (value) => {
    const links = value.field.links;
    if (!links || links.length === 0) {
        return undefined;
    }
    return {
        getLinks: (replaceVariables) => {
            const scopedVars = {};
            if (value.view) {
                const { dataFrame } = value.view;
                scopedVars['__series'] = {
                    value: {
                        name: dataFrame.name,
                        refId: dataFrame.refId,
                    },
                    text: 'Series',
                };
                const field = value.colIndex !== undefined ? dataFrame.fields[value.colIndex] : undefined;
                if (field) {
                    scopedVars['__field'] = {
                        value: {
                            name: field.name,
                            labels: field.labels,
                        },
                        text: 'Field',
                    };
                    if (value.rowIndex !== undefined && value.rowIndex >= 0) {
                        const { timeField } = getTimeField(dataFrame);
                        scopedVars['__value'] = {
                            value: {
                                raw: field.values[value.rowIndex],
                                numeric: value.display.numeric,
                                text: formattedValueToString(value.display),
                                time: timeField ? timeField.values[value.rowIndex] : undefined,
                            },
                            text: 'Value',
                        };
                    }
                    // Expose other values on the row
                    if (value.view) {
                        scopedVars['__data'] = {
                            value: {
                                name: dataFrame.name,
                                refId: dataFrame.refId,
                                fields: getFieldDisplayValuesProxy({
                                    frame: dataFrame,
                                    rowIndex: value.rowIndex,
                                }),
                            },
                            text: 'Data',
                        };
                    }
                }
                else {
                    // calculation
                    scopedVars['__value'] = {
                        value: {
                            raw: value.display.numeric,
                            numeric: value.display.numeric,
                            text: formattedValueToString(value.display),
                            calc: value.name,
                        },
                        text: 'Value',
                    };
                }
            }
            else {
                console.log('VALUE', value);
            }
            const replace = (value, vars, fmt) => {
                const finalVars = Object.assign(Object.assign({}, scopedVars), vars);
                return replaceVariables(value, finalVars, fmt);
            };
            return links.map((link) => {
                return getLinkSrv().getDataLinkUIModel(link, replace, value);
            });
        },
    };
};
export const getPanelLinksSupplier = (panel) => {
    const links = panel.links;
    if (!links || links.length === 0) {
        return undefined;
    }
    return {
        getLinks: () => {
            return links.map((link) => {
                return getLinkSrv().getDataLinkUIModel(link, panel.replaceVariables, panel);
            });
        },
    };
};
//# sourceMappingURL=linkSuppliers.js.map