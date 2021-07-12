import { map } from 'rxjs/operators';
import {
  ArrayVector,
  DataFrame,
  DataTransformerID,
  DataTransformerInfo,
  Field,
  FieldType,
  getFieldDisplayName,
  Labels,
} from '@grafana/data';
import {
  getFieldConfigFromFrame,
  FieldToConfigMapping,
  getConfigHandlerKeyForField,
  lookUpConfigHandler,
} from '../fieldToConfigMapping/fieldToConfigMapping';

export interface RowToFieldsTransformOptions {
  nameField?: string;
  valueField?: string;
  mappings?: FieldToConfigMapping[];
}

export const rowsToFieldsTransformer: DataTransformerInfo<RowToFieldsTransformOptions> = {
  id: DataTransformerID.rowsToFields,
  name: 'Rows to fields',
  description: 'Convert each row into a field with dynamic config',
  defaultOptions: {},

  /**
   * Return a modified copy of the series.  If the transform is not or should not
   * be applied, just return the input series
   */
  operator: (options) => (source) =>
    source.pipe(
      map((data) => {
        return data.map((frame) => rowsToFields(options, frame));
      })
    ),
};

export function rowsToFields(options: RowToFieldsTransformOptions, data: DataFrame): DataFrame {
  const mappings = options.mappings || [];

  // Look up name and value field in mappings
  let nameFieldName = mappings.find((x) => x.handlerKey === 'field.name')?.fieldName;
  let valueFieldName = mappings.find((x) => x.handlerKey === 'field.value')?.fieldName;

  let nameField: Field | null = null;
  let valueField: Field | null = null;

  for (const field of data.fields) {
    const fieldName = getFieldDisplayName(field, data);

    if (!nameField) {
      // When no name field defined default to first string field
      if (nameFieldName == null && field.type === FieldType.string) {
        nameField = field;
        continue;
      } else if (fieldName === nameFieldName) {
        nameField = field;
      }
    }

    if (!valueField) {
      // When no value field defined default to first number field
      if (valueFieldName == null && field.type === FieldType.number) {
        valueField = field;
        continue;
      } else if (fieldName === valueFieldName) {
        valueField = field;
      }
    }
  }

  if (!nameField || !valueField) {
    return data;
  }

  const outFields: Field[] = [];

  for (let index = 0; index < nameField.values.length; index++) {
    const name = nameField.values.get(index);
    const value = valueField.values.get(index);
    const config = getFieldConfigFromFrame(data, index, mappings);
    const labels = getLabelsFromRow(data, index, mappings, nameField, valueField);

    const field: Field = {
      name: name,
      type: valueField.type,
      values: new ArrayVector([value]),
      config: config,
      labels,
    };

    outFields.push(field);
  }

  return {
    fields: outFields,
    length: 1,
  };
}

function getLabelsFromRow(
  frame: DataFrame,
  index: number,
  mappings: FieldToConfigMapping[],
  nameField: Field,
  valueField: Field
): Labels {
  const labels = { ...valueField.labels };

  for (let i = 0; i < frame.fields.length; i++) {
    const field = frame.fields[i];
    const fieldName = getFieldDisplayName(field, frame);

    if (field === nameField || field === valueField || field.type !== FieldType.string) {
      continue;
    }

    const handlerKey = getConfigHandlerKeyForField(fieldName, mappings);
    const configDef = lookUpConfigHandler(handlerKey);
    if (configDef) {
      continue;
    }

    const value = field.values.get(index);
    if (value != null) {
      labels[fieldName] = value;
    }
  }

  return labels;
}
