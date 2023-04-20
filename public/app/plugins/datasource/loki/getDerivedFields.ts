import { groupBy } from 'lodash';

import { FieldType, DataFrame, ArrayVector, DataLink, Field } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';

import { DerivedFieldConfig } from './types';

export function getDerivedFields(dataFrame: DataFrame, derivedFieldConfigs: DerivedFieldConfig[]): Field[] {
  if (!derivedFieldConfigs.length) {
    return [];
  }
  const derivedFieldsGrouped = groupBy(derivedFieldConfigs, 'name');

  const newFields = Object.values(derivedFieldsGrouped).map(fieldFromDerivedFieldConfig);

  // line-field is the first string-field
  // NOTE: we should create some common log-frame-extra-string-field code somewhere
  const lineField = dataFrame.fields.find((f) => f.type === FieldType.string);

  if (lineField === undefined) {
    // if this is happening, something went wrong, let's raise an error
    throw new Error('invalid logs-dataframe, string-field missing');
  }

  lineField.values.toArray().forEach((line) => {
    for (const field of newFields) {
      const logMatch = line.match(derivedFieldsGrouped[field.name][0].matcherRegex);
      field.values.add(logMatch && logMatch[1]);
    }
  });

  return newFields;
}

/**
 * Transform derivedField config into dataframe field with config that contains link.
 */
function fieldFromDerivedFieldConfig(derivedFieldConfigs: DerivedFieldConfig[]): Field<any, ArrayVector> {
  const dataSourceSrv = getDataSourceSrv();

  const dataLinks = derivedFieldConfigs.reduce<DataLink[]>((acc, derivedFieldConfig) => {
    // Having field.datasourceUid means it is an internal link.
    if (derivedFieldConfig.datasourceUid) {
      const dsSettings = dataSourceSrv.getInstanceSettings(derivedFieldConfig.datasourceUid);

      acc.push({
        // Will be filled out later
        title: derivedFieldConfig.urlDisplayLabel || '',
        url: '',
        // This is hardcoded for Jaeger or Zipkin not way right now to specify datasource specific query object
        internal: {
          query: { query: derivedFieldConfig.url, queryType: dsSettings?.type === 'tempo' ? 'traceql' : undefined },
          datasourceUid: derivedFieldConfig.datasourceUid,
          datasourceName: dsSettings?.name ?? 'Data source not found',
        },
      });
    } else if (derivedFieldConfig.url) {
      acc.push({
        // We do not know what title to give here so we count on presentation layer to create a title from metadata.
        title: derivedFieldConfig.urlDisplayLabel || '',
        // This is hardcoded for Jaeger or Zipkin not way right now to specify datasource specific query object
        url: derivedFieldConfig.url,
      });
    }
    return acc;
  }, []);

  return {
    name: derivedFieldConfigs[0].name,
    type: FieldType.string,
    config: {
      links: dataLinks,
    },
    // We are adding values later on
    values: new ArrayVector<string>([]),
  };
}
