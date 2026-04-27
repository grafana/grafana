import { map } from 'rxjs/operators';

import { type DataFrame, type Field } from '@grafana/data/dataframe';
import { getFieldDisplayName } from '@grafana/data/field';
import { DataTransformerID } from '@grafana/data/transformations';
import type { DataTransformerInfo, Labels } from '@grafana/data/types';
import { t } from '@grafana/i18n';

import {
  type EvaluatedMappingResult,
  evaluateFieldMappings,
  FieldConfigHandlerKey,
  type FieldToConfigMapping,
  getFieldConfigFromFrame,
} from '../fieldToConfigMapping/fieldToConfigMapping';

export interface RowToFieldsTransformOptions {
  nameField?: string;
  valueField?: string;
  mappings?: FieldToConfigMapping[];
}

export const getRowsToFieldsTransformer: () => DataTransformerInfo<RowToFieldsTransformOptions> = () => ({
  id: DataTransformerID.rowsToFields,
  name: t('transformers.get-rows-to-fields-transformer.name.rows-to-fields', 'Rows to fields'),
  description: t(
    'transformers.get-rows-to-fields-transformer.description.convert-field-dynamic-config',
    'Convert each row into a field with dynamic config.'
  ),
  defaultOptions: {},

  /**
   * Return a modified copy of the series. If the transform is not or should not
   * be applied, just return the input series
   */
  operator: (options) => (source) =>
    source.pipe(
      map((data) => {
        return data.map((frame) => rowsToFields(options, frame));
      })
    ),
});

export function rowsToFields(options: RowToFieldsTransformOptions, data: DataFrame): DataFrame {
  const mappingResult = evaluateFieldMappings(data, options.mappings ?? [], true);
  const { nameField, valueField } = mappingResult;

  if (!nameField || !valueField) {
    return data;
  }

  const outFields: Field[] = [];

  for (let index = 0; index < nameField.values.length; index++) {
    const name = nameField.values[index];
    const value = valueField.values[index];
    const config = getFieldConfigFromFrame(data, index, mappingResult);
    const labels = getLabelsFromRow(data, index, mappingResult);

    const field: Field = {
      name: `${name}`,
      type: valueField.type,
      values: [value],
      config: config,
      labels,
    };

    outFields.push(field);
  }

  return {
    fields: outFields,
    length: 1,
    refId: `${DataTransformerID.rowsToFields}-${data.refId}`,
  };
}

function getLabelsFromRow(frame: DataFrame, index: number, mappingResult: EvaluatedMappingResult): Labels {
  const labels = { ...mappingResult.nameField!.labels };

  for (let i = 0; i < frame.fields.length; i++) {
    const field = frame.fields[i];
    const fieldName = getFieldDisplayName(field, frame);
    const fieldMapping = mappingResult.index[fieldName];

    if (fieldMapping.handler && fieldMapping.handler.key !== FieldConfigHandlerKey.Label) {
      continue;
    }

    const value = field.values[index];
    if (value != null) {
      labels[fieldName] = value;
    }
  }

  return labels;
}
