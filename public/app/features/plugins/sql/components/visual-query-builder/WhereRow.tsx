import { injectGlobal } from '@emotion/css';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Actions, Builder, BuilderProps, Config, ImmutableTree, Query, Utils } from 'react-awesome-query-builder';

import { QueryFormat, SQLExpression } from '../../types';

import { emptyInitTree, raqbConfig } from './AwesomeQueryBuilder';
import { timeAlias } from './SelectRow';

interface SQLBuilderWhereRowProps {
  sql: SQLExpression;
  format: QueryFormat;
  onSqlChange: (sql: SQLExpression) => void;
  config: Partial<Config>;
}

export function WhereRow({ sql, config, onSqlChange, format }: SQLBuilderWhereRowProps) {
  const configWithDefaults = { ...raqbConfig, ...config };
  const actions = useRef<Actions>();
  const [tree, setTree] = useState<ImmutableTree>(
    Utils.checkTree(Utils.loadTree(sql.whereJsonTree ?? emptyInitTree), configWithDefaults)
  );

  useEffect(() => {
    if (actions?.current && !sql.whereJsonTree && format === QueryFormat.Timeseries) {
      const timeField = sql.columns?.find((c) => c.alias === `"${timeAlias.value}"`)?.parameters?.[0].name;
      actions.current.addRule([tree.get('id')], {
        field: timeField,
        operator: 'macros',
        value: ['timeFilter'],
        valueSrc: ['value'],
        valueType: ['datetime'],
      });
    }
  }, [actions, format, tree, sql.whereJsonTree, sql.columns]);

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

  const renderBuilder = useCallback((builderProps: BuilderProps) => {
    actions.current = builderProps.actions;
    return <Builder {...builderProps} />;
  }, []);

  return <Query {...configWithDefaults} value={tree} onChange={onTreeChange} renderBuilder={renderBuilder} />;
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
