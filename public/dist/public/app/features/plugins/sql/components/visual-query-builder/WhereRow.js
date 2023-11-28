import { injectGlobal } from '@emotion/css';
import { Builder, Query, Utils } from '@react-awesome-query-builder/ui';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { emptyInitTree, raqbConfig } from './AwesomeQueryBuilder';
export function WhereRow({ sql, config, onSqlChange }) {
    const [tree, setTree] = useState();
    const configWithDefaults = useMemo(() => (Object.assign(Object.assign({}, raqbConfig), config)), [config]);
    useEffect(() => {
        var _a;
        // Set the initial tree
        if (!tree) {
            const initTree = Utils.checkTree(Utils.loadTree((_a = sql.whereJsonTree) !== null && _a !== void 0 ? _a : emptyInitTree), configWithDefaults);
            setTree(initTree);
        }
    }, [configWithDefaults, sql.whereJsonTree, tree]);
    useEffect(() => {
        if (!sql.whereJsonTree) {
            setTree(Utils.checkTree(Utils.loadTree(emptyInitTree), configWithDefaults));
        }
    }, [configWithDefaults, sql.whereJsonTree]);
    const onTreeChange = useCallback((changedTree, config) => {
        setTree(changedTree);
        const newSql = Object.assign(Object.assign({}, sql), { whereJsonTree: Utils.getTree(changedTree), whereString: Utils.sqlFormat(changedTree, config) });
        onSqlChange(newSql);
    }, [onSqlChange, sql]);
    if (!tree) {
        return null;
    }
    return (React.createElement(Query, Object.assign({}, configWithDefaults, { value: tree, onChange: onTreeChange, renderBuilder: (props) => React.createElement(Builder, Object.assign({}, props)) })));
}
function flex(direction) {
    return `
    display: flex;
    gap: 8px;
    flex-direction: ${direction};`;
}
// eslint-disable-next-line @typescript-eslint/no-unused-expressions
injectGlobal `
  .group--header {
    ${flex('row')}
  }

  .group-or-rule {
    ${flex('column')}
    .rule {
      flex-direction: row;
    }
  }

  .rule--body {
    ${flex('row')}
  }

  .group--children {
    ${flex('column')}
  }

  .group--conjunctions:empty {
    display: none;
  }
`;
//# sourceMappingURL=WhereRow.js.map