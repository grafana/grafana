// @ts-ignore
import sqlFormatter from 'sql-formatter-plus';
export function formatSQL(q) {
    return sqlFormatter.format(q).replace(/(\$ \{ .* \})|(\$ __)|(\$ \w+)/g, (m) => {
        return m.replace(/\s/g, '');
    });
}
//# sourceMappingURL=formatSQL.js.map