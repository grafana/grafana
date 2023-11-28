import { isEmpty } from 'lodash';
import { createSelectClause, haveColumns } from 'app/features/plugins/sql/utils/sql.utils';
export function getFieldConfig(type) {
    switch (type) {
        case 'boolean': {
            return { raqbFieldType: 'boolean', icon: 'toggle-off' };
        }
        case 'bit':
        case 'bit varying':
        case 'character':
        case 'character varying':
        case 'text': {
            return { raqbFieldType: 'text', icon: 'text' };
        }
        case 'smallint':
        case 'integer':
        case 'bigint':
        case 'decimal':
        case 'numeric':
        case 'real':
        case 'double precision':
        case 'serial':
        case 'bigserial':
        case 'smallserial': {
            return { raqbFieldType: 'number', icon: 'calculator-alt' };
        }
        case 'date': {
            return { raqbFieldType: 'date', icon: 'clock-nine' };
        }
        case 'time':
        case 'time with time zone':
        case 'time without time zone':
        case 'interval': {
            return { raqbFieldType: 'time', icon: 'clock-nine' };
        }
        case 'timestamp':
        case 'timestamp with time zone':
        case 'timestamp without time zone': {
            return { raqbFieldType: 'datetime', icon: 'clock-nine' };
        }
        default:
            return { raqbFieldType: 'text', icon: 'text' };
    }
}
export function toRawSql({ sql, table }) {
    var _a, _b, _c, _d;
    let rawQuery = '';
    // Return early with empty string if there is no sql column
    if (!sql || !haveColumns(sql.columns)) {
        return rawQuery;
    }
    rawQuery += createSelectClause(sql.columns);
    if (table) {
        rawQuery += `FROM ${table} `;
    }
    if (sql.whereString) {
        rawQuery += `WHERE ${sql.whereString} `;
    }
    if ((_b = (_a = sql.groupBy) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.property.name) {
        const groupBy = sql.groupBy.map((g) => g.property.name).filter((g) => !isEmpty(g));
        rawQuery += `GROUP BY ${groupBy.join(', ')} `;
    }
    if ((_c = sql.orderBy) === null || _c === void 0 ? void 0 : _c.property.name) {
        rawQuery += `ORDER BY ${sql.orderBy.property.name} `;
    }
    if (((_d = sql.orderBy) === null || _d === void 0 ? void 0 : _d.property.name) && sql.orderByDirection) {
        rawQuery += `${sql.orderByDirection} `;
    }
    // Altough LIMIT 0 doesn't make sense, it is still possible to have LIMIT 0
    if (sql.limit !== undefined && sql.limit >= 0) {
        rawQuery += `LIMIT ${sql.limit} `;
    }
    return rawQuery;
}
//# sourceMappingURL=sqlUtil.js.map