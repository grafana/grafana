import { chain } from 'lodash';
import { DataLinkBuiltInVars, deprecationWarning, FieldType, getFieldDisplayName, locationUtil, textUtil, urlUtil, VariableOrigin, VariableSuggestionsScope, } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { VariableFormatID } from '@grafana/schema';
import { getConfig } from 'app/core/config';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { getVariablesUrlParams } from '../../variables/getAllVariableValuesForUrl';
const timeRangeVars = [
    {
        value: `${DataLinkBuiltInVars.keepTime}`,
        label: 'Time range',
        documentation: 'Adds current time range',
        origin: VariableOrigin.BuiltIn,
    },
    {
        value: `${DataLinkBuiltInVars.timeRangeFrom}`,
        label: 'Time range: from',
        documentation: "Adds current time range's from value",
        origin: VariableOrigin.BuiltIn,
    },
    {
        value: `${DataLinkBuiltInVars.timeRangeTo}`,
        label: 'Time range: to',
        documentation: "Adds current time range's to value",
        origin: VariableOrigin.BuiltIn,
    },
];
const seriesVars = [
    {
        value: `${DataLinkBuiltInVars.seriesName}`,
        label: 'Name',
        documentation: 'Name of the series',
        origin: VariableOrigin.Series,
    },
];
const valueVars = [
    {
        value: `${DataLinkBuiltInVars.valueNumeric}`,
        label: 'Numeric',
        documentation: 'Numeric representation of selected value',
        origin: VariableOrigin.Value,
    },
    {
        value: `${DataLinkBuiltInVars.valueText}`,
        label: 'Text',
        documentation: 'Text representation of selected value',
        origin: VariableOrigin.Value,
    },
    {
        value: `${DataLinkBuiltInVars.valueRaw}`,
        label: 'Raw',
        documentation: 'Raw value',
        origin: VariableOrigin.Value,
    },
];
const buildLabelPath = (label) => {
    return label.includes('.') || label.trim().includes(' ') ? `["${label}"]` : `.${label}`;
};
export const getPanelLinksVariableSuggestions = () => [
    ...getTemplateSrv()
        .getVariables()
        .map((variable) => ({
        value: variable.name,
        label: variable.name,
        origin: VariableOrigin.Template,
    })),
    {
        value: `${DataLinkBuiltInVars.includeVars}`,
        label: 'All variables',
        documentation: 'Adds current variables',
        origin: VariableOrigin.Template,
    },
    ...timeRangeVars,
];
const getFieldVars = (dataFrames) => {
    const all = [];
    for (const df of dataFrames) {
        for (const f of df.fields) {
            if (f.labels) {
                for (const k of Object.keys(f.labels)) {
                    all.push(k);
                }
            }
        }
    }
    const labels = chain(all).flatten().uniq().value();
    return [
        {
            value: `${DataLinkBuiltInVars.fieldName}`,
            label: 'Name',
            documentation: 'Field name of the clicked datapoint (in ms epoch)',
            origin: VariableOrigin.Field,
        },
        ...labels.map((label) => ({
            value: `__field.labels${buildLabelPath(label)}`,
            label: `labels.${label}`,
            documentation: `${label} label value`,
            origin: VariableOrigin.Field,
        })),
    ];
};
export const getDataFrameVars = (dataFrames) => {
    let numeric = undefined;
    let title = undefined;
    const suggestions = [];
    const keys = {};
    if (dataFrames.length !== 1) {
        // It's not possible to access fields of other dataframes. So if there are multiple dataframes we need to skip these suggestions.
        // Also return early if there are no dataFrames.
        return [];
    }
    const frame = dataFrames[0];
    for (const field of frame.fields) {
        const displayName = getFieldDisplayName(field, frame, dataFrames);
        if (keys[displayName]) {
            continue;
        }
        suggestions.push({
            value: `__data.fields${buildLabelPath(displayName)}`,
            label: `${displayName}`,
            documentation: `Formatted value for ${displayName} on the same row`,
            origin: VariableOrigin.Fields,
        });
        keys[displayName] = true;
        if (!numeric && field.type === FieldType.number) {
            numeric = Object.assign(Object.assign({}, field), { name: displayName });
        }
        if (!title && field.config.displayName && field.config.displayName !== field.name) {
            title = Object.assign(Object.assign({}, field), { name: displayName });
        }
    }
    if (suggestions.length) {
        suggestions.push({
            value: `__data.fields[0]`,
            label: `Select by index`,
            documentation: `Enter the field order`,
            origin: VariableOrigin.Fields,
        });
    }
    if (numeric) {
        suggestions.push({
            value: `__data.fields${buildLabelPath(numeric.name)}.numeric`,
            label: `Show numeric value`,
            documentation: `the numeric field value`,
            origin: VariableOrigin.Fields,
        });
        suggestions.push({
            value: `__data.fields${buildLabelPath(numeric.name)}.text`,
            label: `Show text value`,
            documentation: `the text value`,
            origin: VariableOrigin.Fields,
        });
    }
    if (title) {
        suggestions.push({
            value: `__data.fields${buildLabelPath(title.name)}`,
            label: `Select by title`,
            documentation: `Use the title to pick the field`,
            origin: VariableOrigin.Fields,
        });
    }
    return suggestions;
};
export const getDataLinksVariableSuggestions = (dataFrames, scope) => {
    const valueTimeVar = {
        value: `${DataLinkBuiltInVars.valueTime}`,
        label: 'Time',
        documentation: 'Time value of the clicked datapoint (in ms epoch)',
        origin: VariableOrigin.Value,
    };
    const includeValueVars = scope === VariableSuggestionsScope.Values;
    return includeValueVars
        ? [
            ...seriesVars,
            ...getFieldVars(dataFrames),
            ...valueVars,
            valueTimeVar,
            ...getDataFrameVars(dataFrames),
            ...getPanelLinksVariableSuggestions(),
        ]
        : [
            ...seriesVars,
            ...getFieldVars(dataFrames),
            ...getDataFrameVars(dataFrames),
            ...getPanelLinksVariableSuggestions(),
        ];
};
export const getCalculationValueDataLinksVariableSuggestions = (dataFrames) => {
    const fieldVars = getFieldVars(dataFrames);
    const valueCalcVar = {
        value: `${DataLinkBuiltInVars.valueCalc}`,
        label: 'Calculation name',
        documentation: 'Name of the calculation the value is a result of',
        origin: VariableOrigin.Value,
    };
    return [...seriesVars, ...fieldVars, ...valueVars, valueCalcVar, ...getPanelLinksVariableSuggestions()];
};
export class LinkSrv {
    constructor() {
        /**
         * Returns LinkModel which is basically a DataLink with all values interpolated through the templateSrv.
         */
        this.getDataLinkUIModel = (link, replaceVariables, origin) => {
            var _a;
            let href = link.url;
            if (link.onBuildUrl) {
                href = link.onBuildUrl({
                    origin,
                    replaceVariables,
                });
            }
            const info = {
                href: locationUtil.assureBaseUrl(href.replace(/\n/g, '')),
                title: (_a = link.title) !== null && _a !== void 0 ? _a : '',
                target: link.targetBlank ? '_blank' : undefined,
                origin,
            };
            if (replaceVariables) {
                info.href = replaceVariables(info.href, undefined, VariableFormatID.UriEncode);
                info.title = replaceVariables(link.title);
            }
            if (link.onClick) {
                info.onClick = (e) => {
                    link.onClick({
                        origin,
                        replaceVariables,
                        e,
                    });
                };
            }
            info.href = getConfig().disableSanitizeHtml ? info.href : textUtil.sanitizeUrl(info.href);
            return info;
        };
    }
    getLinkUrl(link) {
        let url = locationUtil.assureBaseUrl(getTemplateSrv().replace(link.url || ''));
        let params = {};
        if (link.keepTime) {
            const range = getTimeSrv().timeRangeForUrl();
            params['from'] = range.from;
            params['to'] = range.to;
        }
        if (link.includeVars) {
            params = Object.assign(Object.assign({}, params), getVariablesUrlParams());
        }
        url = urlUtil.appendQueryToUrl(url, urlUtil.toUrlParams(params));
        return getConfig().disableSanitizeHtml ? url : textUtil.sanitizeUrl(url);
    }
    getAnchorInfo(link) {
        const templateSrv = getTemplateSrv();
        return {
            href: this.getLinkUrl(link),
            title: templateSrv.replace(link.title || ''),
            tooltip: templateSrv.replace(link.tooltip || ''),
        };
    }
    /**
     * getPanelLinkAnchorInfo method is left for plugins compatibility reasons
     *
     * @deprecated Drilldown links should be generated using getDataLinkUIModel method
     */
    getPanelLinkAnchorInfo(link, scopedVars) {
        deprecationWarning('link_srv.ts', 'getPanelLinkAnchorInfo', 'getDataLinkUIModel');
        const replace = (value, vars, fmt) => getTemplateSrv().replace(value, Object.assign(Object.assign({}, scopedVars), vars), fmt);
        return this.getDataLinkUIModel(link, replace, {});
    }
}
let singleton;
export function setLinkSrv(srv) {
    singleton = srv;
}
export function getLinkSrv() {
    if (!singleton) {
        singleton = new LinkSrv();
    }
    return singleton;
}
//# sourceMappingURL=link_srv.js.map