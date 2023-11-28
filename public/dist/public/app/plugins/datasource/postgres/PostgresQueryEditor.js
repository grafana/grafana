import React from 'react';
import { SqlQueryEditor } from 'app/features/plugins/sql/components/QueryEditor';
const queryHeaderProps = { isPostgresInstance: true };
export function PostgresQueryEditor(props) {
    return React.createElement(SqlQueryEditor, Object.assign({}, props, { queryHeaderProps: queryHeaderProps }));
}
//# sourceMappingURL=PostgresQueryEditor.js.map