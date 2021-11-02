import { __assign } from "tslib";
import { formattedValueToString, getFieldDisplayValuesProxy, getTimeField, } from '@grafana/data';
import { getLinkSrv } from './link_srv';
/**
 * Link suppliers creates link models based on a link origin
 */
export var getFieldLinksSupplier = function (value) {
    var links = value.field.links;
    if (!links || links.length === 0) {
        return undefined;
    }
    return {
        getLinks: function (replaceVariables) {
            var scopedVars = {};
            if (value.view) {
                var dataFrame = value.view.dataFrame;
                scopedVars['__series'] = {
                    value: {
                        name: dataFrame.name,
                        refId: dataFrame.refId,
                    },
                    text: 'Series',
                };
                var field = value.colIndex !== undefined ? dataFrame.fields[value.colIndex] : undefined;
                if (field) {
                    scopedVars['__field'] = {
                        value: {
                            name: field.name,
                            labels: field.labels,
                        },
                        text: 'Field',
                    };
                    if (value.rowIndex !== undefined && value.rowIndex >= 0) {
                        var timeField = getTimeField(dataFrame).timeField;
                        scopedVars['__value'] = {
                            value: {
                                raw: field.values.get(value.rowIndex),
                                numeric: value.display.numeric,
                                text: formattedValueToString(value.display),
                                time: timeField ? timeField.values.get(value.rowIndex) : undefined,
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
            var replace = function (value, vars, fmt) {
                var finalVars = __assign(__assign({}, scopedVars), vars);
                return replaceVariables(value, finalVars, fmt);
            };
            return links.map(function (link) {
                return getLinkSrv().getDataLinkUIModel(link, replace, value);
            });
        },
    };
};
export var getPanelLinksSupplier = function (panel) {
    var links = panel.links;
    if (!links || links.length === 0) {
        return undefined;
    }
    return {
        getLinks: function () {
            return links.map(function (link) {
                return getLinkSrv().getDataLinkUIModel(link, panel.replaceVariables, panel);
            });
        },
    };
};
//# sourceMappingURL=linkSuppliers.js.map