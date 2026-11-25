import { injectGlobal } from '@emotion/css';
import { Builder, type Config, type ImmutableTree, Query, Utils } from '@react-awesome-query-builder/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { type SQLExpression } from '../../types';

import { emptyInitTree, raqbConfig } from './AwesomeQueryBuilder';

interface SQLBuilderWhereRowProps {
  sql: SQLExpression;
  onSqlChange: (sql: SQLExpression) => void;
  config?: Partial<Config>;
}

export function WhereRow({ sql, config, onSqlChange }: SQLBuilderWhereRowProps) {
  const configWithDefaults = useMemo(() => ({ ...raqbConfig, ...config }), [config]);
  const [tree, setTree] = useState<ImmutableTree>(() =>
    Utils.checkTree(Utils.loadTree(sql.whereJsonTree ?? emptyInitTree), configWithDefaults)
  );

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
