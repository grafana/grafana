import { SelectableValue } from '@grafana/data';

export function mapFieldsToTypes(columns: SelectableValue[]) {
  const fields: SelectableValue[] = [];
  for (const col of columns) {
    let type = 'text';
    switch (col.type) {
      case 'BOOLEAN':
      case 'BOOL': {
        type = 'boolean';
        break;
      }
      case 'BYTES': {
        type = 'text';
        break;
      }
      case 'FLOAT':
      case 'FLOAT64':
      case 'INTEGER':
      case 'INT64':
      case 'NUMERIC':
      case 'BIGNUMERIC': {
        type = 'number';
        break;
      }
      case 'DATE': {
        type = 'date';
        break;
      }
      case 'DATETIME': {
        type = 'datetime';
        break;
      }
      case 'TIME': {
        type = 'time';
        break;
      }
      case 'TIMESTAMP': {
        type = 'datetime';
        break;
      }
      case 'GEOGRAPHY': {
        type = 'text';
        break;
      }
      default:
        break;
    }

    fields.push({ ...col, type, icon: mapColumnTypeToIcon(col.type.toUpperCase()) });
  }
  return fields;
}

export function mapColumnTypeToIcon(type: string) {
  switch (type) {
    case 'TIME':
    case 'DATETIME':
    case 'TIMESTAMP':
      return 'clock-nine';
    case 'BOOLEAN':
      return 'toggle-off';
    case 'INTEGER':
    case 'FLOAT':
    case 'FLOAT64':
    case 'INT':
    case 'SMALLINT':
    case 'BIGINT':
    case 'TINYINT':
    case 'BYTEINT':
    case 'INT64':
    case 'INT64':
    case 'NUMERIC':
    case 'DECIMAL':
      return 'calculator-alt';
    case 'STRING':
    case 'BYTES':
      return 'text';
    case 'GEOGRAPHY':
      return 'map';
    default:
      return undefined;
  }
}
