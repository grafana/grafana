import { isEmpty } from 'lodash';
import { haveColumns } from 'app/features/plugins/sql/utils/sql.utils';
export function getIcon(type) {
    switch (type) {
        case 'datetimeoffset':
        case 'date':
        case 'datetime2':
        case 'smalldatetime':
        case 'datetime':
        case 'time':
            return 'clock-nine';
        case 'bit':
            return 'toggle-off';
        case 'tinyint':
        case 'smallint':
        case 'int':
        case 'bigint':
        case 'decimal':
        case 'numeric':
        case 'real':
        case 'float':
        case 'money':
        case 'smallmoney':
            return 'calculator-alt';
        case 'char':
        case 'varchar':
        case 'text':
        case 'nchar':
        case 'nvarchar':
        case 'ntext':
        case 'binary':
        case 'varbinary':
        case 'image':
            return 'text';
        default:
            return undefined;
    }
}
export function getRAQBType(type) {
    switch (type) {
        case 'datetimeoffset':
        case 'datetime2':
        case 'smalldatetime':
        case 'datetime':
            return 'datetime';
        case 'time':
            return 'time';
        case 'date':
            return 'date';
        case 'bit':
            return 'boolean';
        case 'tinyint':
        case 'smallint':
        case 'int':
        case 'bigint':
        case 'decimal':
        case 'numeric':
        case 'real':
        case 'float':
        case 'money':
        case 'smallmoney':
            return 'number';
        case 'char':
        case 'varchar':
        case 'text':
        case 'nchar':
        case 'nvarchar':
        case 'ntext':
        case 'binary':
        case 'varbinary':
        case 'image':
            return 'text';
        default:
            return 'text';
    }
}
export function toRawSql({ sql, dataset, table }) {
    var _a, _b, _c, _d;
    let rawQuery = '';
    // Return early with empty string if there is no sql column
    if (!sql || !haveColumns(sql.columns)) {
        return rawQuery;
    }
    rawQuery += createSelectClause(sql.columns, sql.limit);
    if (dataset && table) {
        rawQuery += `FROM ${dataset}.${table} `;
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
    return rawQuery;
}
function createSelectClause(sqlColumns, limit) {
    const columns = sqlColumns.map((c) => {
        var _a, _b, _c, _d;
        let rawColumn = '';
        if (c.name && c.alias) {
            rawColumn += `${c.name}(${(_a = c.parameters) === null || _a === void 0 ? void 0 : _a.map((p) => `${p.name}`)}) AS ${c.alias}`;
        }
        else if (c.name) {
            rawColumn += `${c.name}(${(_b = c.parameters) === null || _b === void 0 ? void 0 : _b.map((p) => `${p.name}`)})`;
        }
        else if (c.alias) {
            rawColumn += `${(_c = c.parameters) === null || _c === void 0 ? void 0 : _c.map((p) => `${p.name}`)} AS ${c.alias}`;
        }
        else {
            rawColumn += `${(_d = c.parameters) === null || _d === void 0 ? void 0 : _d.map((p) => `${p.name}`)}`;
        }
        return rawColumn;
    });
    return `SELECT ${isLimit(limit) ? 'TOP(' + limit + ')' : ''} ${columns.join(', ')} `;
}
const isLimit = (limit) => limit !== undefined && limit >= 0;
//# sourceMappingURL=sqlUtil.js.map