export function mapFieldsToTypes(columns) {
    var _a;
    const fields = [];
    for (const col of columns) {
        let type = 'text';
        switch ((_a = col.type) === null || _a === void 0 ? void 0 : _a.toUpperCase()) {
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
        fields.push(Object.assign(Object.assign({}, col), { raqbFieldType: type, icon: mapColumnTypeToIcon(col.type.toUpperCase()) }));
    }
    return fields;
}
export function mapColumnTypeToIcon(type) {
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
//# sourceMappingURL=fields.js.map