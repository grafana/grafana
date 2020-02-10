import { DataFrame, Field, FieldType } from '../types/dataFrame';
import { KeyValue } from '../types/data';
import { chain } from 'lodash';

export enum VariableOrigin {
  Series = 'series',
  Field = 'field',
  Fields = 'fields',
  Value = 'value',
  BuiltIn = 'built-in',
  Template = 'template',
}

export interface VariableSuggestion {
  value: string;
  label: string;
  documentation?: string;
  origin: VariableOrigin;
}

export const DataLinkBuiltInVars = {
  keepTime: '__url_time_range',
  timeRangeFrom: '__from',
  timeRangeTo: '__to',
  includeVars: '__all_variables',
  seriesName: '__series.name',
  fieldName: '__field.name',
  valueTime: '__value.time',
  valueNumeric: '__value.numeric',
  valueText: '__value.text',
  valueRaw: '__value.raw',
  // name of the calculation represented by the value
  valueCalc: '__value.calc',
};

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

let templateSrvInstance: {
  variables: Array<{ name: string }>;
};

export const getPanelLinksVariableSuggestions = (): VariableSuggestion[] => [
  ...templateSrvInstance.variables.map(variable => ({
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

  const labels = chain(all)
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
  // @ts-ignore
  let numeric: Field = undefined;
  // @ts-ignore
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

export const initialiseVariableSuggestions = (templateSrv: any) => (templateSrvInstance = templateSrv);
