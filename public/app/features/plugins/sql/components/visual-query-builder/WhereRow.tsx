import { injectGlobal } from '@emotion/css';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Builder, Config, ImmutableTree, Query, Utils } from 'react-awesome-query-builder';

import { SQLExpression } from '../../types';

import { emptyInitTree, raqbConfig } from './AwesomeQueryBuilder';

interface SQLBuilderWhereRowProps {
  sql: SQLExpression;
  onSqlChange: (sql: SQLExpression) => void;
  config?: Partial<Config>;
}

export function WhereRow({ sql, config, onSqlChange }: SQLBuilderWhereRowProps) {
  const [tree, setTree] = useState<ImmutableTree>();
  const configWithDefaults = useMemo(() => ({ ...raqbConfig, ...config }), [config]);

  useEffect(() => {
    // Set the initial tree
    if (!tree) {
      const initTree = Utils.checkTree(Utils.loadTree(sql.whereJsonTree ?? emptyInitTree), configWithDefaults);
      setTree(initTree);
    }
  }, [configWithDefaults, sql.whereJsonTree, tree]);

  useEffect(() => {
    if (!sql.whereJsonTree) {
      setTree(Utils.checkTree(Utils.loadTree(emptyInitTree), configWithDefaults));
    }
  }, [configWithDefaults, sql.whereJsonTree]);

  const onTreeChange = useCallback(
    (changedTree: ImmutableTree, config: Config) => {
      setTree(changedTree);
      const newSql = {
        ...sql,
        whereJsonTree: Utils.getTree(changedTree),
        whereString: Utils.sqlFormat(changedTree, config),
      };

      onSqlChange(newSql);
    },
    [onSqlChange, sql]
  );

  if (!tree) {
    return null;
  }

  return (
    <Query
      {...configWithDefaults}
      value={tree}
      onChange={onTreeChange}
      renderBuilder={(props) => <Builder {...props} />}
    />
  );
}

function flex(direction: string) {
  return `
    display: flex;
    gap: 8px;
    flex-direction: ${direction};`;
}

// eslint-disable-next-line @typescript-eslint/no-unused-expressions
injectGlobal`
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
