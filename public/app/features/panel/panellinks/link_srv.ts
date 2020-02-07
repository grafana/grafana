import _ from 'lodash';
import { TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import templateSrv, { TemplateSrv } from 'app/features/templating/template_srv';
import coreModule from 'app/core/core_module';
import { appendQueryToUrl, toUrlParams } from 'app/core/utils/url';
import { sanitizeUrl } from 'app/core/utils/text';
import { getConfig } from 'app/core/config';
import { VariableSuggestion, VariableOrigin, DataLinkBuiltInVars } from '@grafana/ui';
import {
  DataLink,
  KeyValue,
  deprecationWarning,
  LinkModel,
  DataFrame,
  ScopedVars,
  FieldType,
  Field,
} from '@grafana/data';

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

const buildLabelPath = (label: string) => {
  return label.indexOf('.') > -1 ? `["${label}"]` : `.${label}`;
};

export const getPanelLinksVariableSuggestions = (): VariableSuggestion[] => [
  ...templateSrv.variables.map(variable => ({
    value: variable.name as string,
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

const getFieldVars = (dataFrames: DataFrame[]) => {
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

  const labels = _.chain(all)
    .flatten()
    .uniq()
    .value();

  return [
    {
      value: `${DataLinkBuiltInVars.fieldName}`,
      label: 'Name',
      documentation: 'Field name of the clicked datapoint (in ms epoch)',
      origin: VariableOrigin.Field,
    },
    ...labels.map(label => ({
      value: `__field.labels${buildLabelPath(label)}`,
      label: `labels.${label}`,
      documentation: `${label} label value`,
      origin: VariableOrigin.Field,
    })),
  ];
};

const getDataFrameVars = (dataFrames: DataFrame[]) => {
  let numeric: Field = undefined;
  let title: Field = undefined;
  const suggestions: VariableSuggestion[] = [];
  const keys: KeyValue<true> = {};
  for (const df of dataFrames) {
    for (const f of df.fields) {
      if (keys[f.name]) {
        continue;
      }
      suggestions.push({
        value: `__data.fields[${f.name}]`,
        label: `${f.name}`,
        documentation: `Formatted value for ${f.name} on the same row`,
        origin: VariableOrigin.Fields,
      });
      keys[f.name] = true;
      if (!numeric && f.type === FieldType.number) {
        numeric = f;
      }
      if (!title && f.config.title && f.config.title !== f.name) {
        title = f;
      }
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
      value: `__data.fields[${numeric.name}].numeric`,
      label: `Show numeric value`,
      documentation: `the numeric field value`,
      origin: VariableOrigin.Fields,
    });
    suggestions.push({
      value: `__data.fields[${numeric.name}].text`,
      label: `Show text value`,
      documentation: `the text value`,
      origin: VariableOrigin.Fields,
    });
  }
  if (title) {
    suggestions.push({
      value: `__data.fields[${title.config.title}]`,
      label: `Select by title`,
      documentation: `Use the title to pick the field`,
      origin: VariableOrigin.Fields,
    });
  }
  return suggestions;
};

export const getDataLinksVariableSuggestions = (dataFrames: DataFrame[]): VariableSuggestion[] => {
  const valueTimeVar = {
    value: `${DataLinkBuiltInVars.valueTime}`,
    label: 'Time',
    documentation: 'Time value of the clicked datapoint (in ms epoch)',
    origin: VariableOrigin.Value,
  };
  return [
    ...seriesVars,
    ...getFieldVars(dataFrames),
    ...valueVars,
    valueTimeVar,
    ...getDataFrameVars(dataFrames),
    ...getPanelLinksVariableSuggestions(),
  ];
};

export const getCalculationValueDataLinksVariableSuggestions = (dataFrames: DataFrame[]): VariableSuggestion[] => {
  const fieldVars = getFieldVars(dataFrames);
  const valueCalcVar = {
    value: `${DataLinkBuiltInVars.valueCalc}`,
    label: 'Calculation name',
    documentation: 'Name of the calculation the value is a result of',
    origin: VariableOrigin.Value,
  };
  return [...seriesVars, ...fieldVars, ...valueVars, valueCalcVar, ...getPanelLinksVariableSuggestions()];
};

export interface LinkService {
  getDataLinkUIModel: <T>(link: DataLink, scopedVars: ScopedVars, origin: T) => LinkModel<T>;
}

export class LinkSrv implements LinkService {
  /** @ngInject */
  constructor(private templateSrv: TemplateSrv, private timeSrv: TimeSrv) {}

  getLinkUrl(link: any) {
    const url = this.templateSrv.replace(link.url || '');
    const params: { [key: string]: any } = {};

    if (link.keepTime) {
      const range = this.timeSrv.timeRangeForUrl();
      params['from'] = range.from;
      params['to'] = range.to;
    }

    if (link.includeVars) {
      this.templateSrv.fillVariableValuesForUrl(params);
    }

    let res = appendQueryToUrl(url, toUrlParams(params));

    if (link.urlParams) {
      res = appendQueryToUrl(res, link.urlParams);
    }

    return res;
  }

  getAnchorInfo(link: any) {
    const info: any = {};
    info.href = this.getLinkUrl(link);
    info.title = this.templateSrv.replace(link.title || '');
    return info;
  }

  /**
   * Returns LinkModel which is basically a DataLink with all values interpolated through the templateSrv.
   */
  getDataLinkUIModel = <T>(link: DataLink, scopedVars: ScopedVars, origin: T): LinkModel<T> => {
    const params: KeyValue = {};
    const timeRangeUrl = toUrlParams(this.timeSrv.timeRangeForUrl());

    let href = link.url;
    if (link.onBuildUrl) {
      href = link.onBuildUrl({
        origin,
        scopedVars,
      });
    }

    let onClick: (e: any) => void = undefined;
    if (link.onClick) {
      onClick = (e: any) => {
        link.onClick({
          origin,
          scopedVars,
          e,
        });
      };
    }

    const info: LinkModel<T> = {
      href: href.replace(/\s|\n/g, ''),
      title: this.templateSrv.replace(link.title || '', scopedVars),
      target: link.targetBlank ? '_blank' : '_self',
      origin,
      onClick,
    };
    this.templateSrv.fillVariableValuesForUrl(params, scopedVars);

    const variablesQuery = toUrlParams(params);
    info.href = this.templateSrv.replace(info.href, {
      ...scopedVars,
      [DataLinkBuiltInVars.keepTime]: {
        text: timeRangeUrl,
        value: timeRangeUrl,
      },
      [DataLinkBuiltInVars.includeVars]: {
        text: variablesQuery,
        value: variablesQuery,
      },
    });
    info.href = getConfig().disableSanitizeHtml ? info.href : sanitizeUrl(info.href);
    return info;
  };

  /**
   * getPanelLinkAnchorInfo method is left for plugins compatibility reasons
   *
   * @deprecated Drilldown links should be generated using getDataLinkUIModel method
   */
  getPanelLinkAnchorInfo(link: DataLink, scopedVars: ScopedVars) {
    deprecationWarning('link_srv.ts', 'getPanelLinkAnchorInfo', 'getDataLinkUIModel');
    return this.getDataLinkUIModel(link, scopedVars, {});
  }
}

let singleton: LinkService;

export function setLinkSrv(srv: LinkService) {
  singleton = srv;
}

export function getLinkSrv(): LinkService {
  return singleton;
}

coreModule.service('linkSrv', LinkSrv);
