import _ from 'lodash';
import {
  DataFrame,
  Field,
  FieldType,
  KeyValue,
  VariableOrigin,
  VariableSuggestion,
  VariableSuggestionsScope,
} from '../types';
import { DataLinkBuiltInVars } from './dataLinks';
import { SuggestionsProvider } from '../types/suggestions';

const valueTimeVar: VariableSuggestion = {
  value: `${DataLinkBuiltInVars.valueTime}`,
  label: 'Time',
  documentation: 'Time value of the clicked datapoint (in ms epoch)',
  origin: VariableOrigin.Value,
};

const timeRangeVars: VariableSuggestion[] = [
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

const seriesVars: VariableSuggestion[] = [
  {
    value: `${DataLinkBuiltInVars.seriesName}`,
    label: 'Name',
    documentation: 'Name of the series',
    origin: VariableOrigin.Series,
  },
];

const valueVars: VariableSuggestion[] = [
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

export const getFieldVariableSuggestions = (dataFrames: DataFrame[]): VariableSuggestion[] => {
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

export const getDataFrameVariableSuggestions = (dataFrames: DataFrame[]): VariableSuggestion[] => {
  let numeric: Field | undefined = undefined;
  let title: Field | undefined = undefined;
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

      if (!title && f.config.displayName && f.config.displayName !== f.name) {
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
      value: `__data.fields[${title.config.displayName}]`,
      label: `Select by title`,
      documentation: `Use the title to pick the field`,
      origin: VariableOrigin.Fields,
    });
  }

  return suggestions;
};

export const getPanelLinksVariableSuggestions: SuggestionsProvider = (
  plugin,
  data,
  getTemplateVariables,
  _scope
): VariableSuggestion[] => [
  ...getTemplateVariables().map(variable => ({
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

export const getDataLinksVariableSuggestions: SuggestionsProvider = (
  plugin,
  data,
  getTemplateVariables,
  scope
): VariableSuggestion[] => {
  const includeValueVars = scope === VariableSuggestionsScope.Values;

  return includeValueVars
    ? [
        ...seriesVars,
        ...getFieldVariableSuggestions(data),
        ...valueVars,
        valueTimeVar,
        ...getDataFrameVariableSuggestions(data),
        ...getPanelLinksVariableSuggestions(plugin, data, getTemplateVariables, scope),
      ]
    : [
        ...seriesVars,
        ...getFieldVariableSuggestions(data),
        ...getDataFrameVariableSuggestions(data),
        ...getPanelLinksVariableSuggestions(plugin, data, getTemplateVariables, scope),
      ];
};

export const getPanelOptionsVariableSuggestions: SuggestionsProvider = (
  plugin,
  data,
  getTemplateVariables
): VariableSuggestion[] => {
  const dataVariables = plugin.meta.skipDataQuery ? [] : getDataFrameVariableSuggestions(data || []);
  return [
    ...dataVariables, // field values
    ...getTemplateVariables().map(variable => ({
      value: variable.name as string,
      label: variable.name,
      origin: VariableOrigin.Template,
    })),
  ];
};
