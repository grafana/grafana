import { RAQBFieldTypes, SQLSelectableValue } from 'app/features/plugins/sql/types';

export function mapFieldsToTypes(columns: SQLSelectableValue[]) {
  const fields: SQLSelectableValue[] = [];
  for (const col of columns) {
    let type: RAQBFieldTypes = 'text';
    switch (col.type?.toUpperCase()) {
      case 'BOOLEAN':
      case 'BOOL': {
        type = 'boolean';
        break;
      }
      case 'BYTES':
      case 'VARCHAR': {
        type = 'text';
        break;
      }
      case 'FLOAT':
      case 'FLOAT64':
      case 'INT':
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

    fields.push({ ...col, raqbFieldType: type, icon: mapColumnTypeToIcon(col.type!.toUpperCase()) });
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
    case 'NUMERIC':
    case 'DECIMAL':
      return 'calculator-alt';
    case 'CHAR':
    case 'VARCHAR':
    case 'STRING':
    case 'BYTES':
    case 'TEXT':
    case 'TINYTEXT':
    case 'MEDIUMTEXT':
    case 'LONGTEXT':
      return 'text';
    case 'GEOGRAPHY':
      return 'map';
    default:
      return undefined;
  }
}
