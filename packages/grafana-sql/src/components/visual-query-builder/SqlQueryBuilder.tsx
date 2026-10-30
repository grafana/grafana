import { type ReactNode, useEffect, useMemo, useRef } from 'react';
import { useAsync } from 'react-use';

import { t } from '@grafana/i18n';
import { EditorRows, EditorRow, EditorField } from '@grafana/plugin-ui';

import { applyQueryDefaults } from '../../defaults';
import { type SQLQuery, type SQLQueryBuilderDB, type QueryRowFilter } from '../../types';

import { Preview } from './Preview';
import { SQLGroupByRow } from './SQLGroupByRow';
import { SQLOrderByRow } from './SQLOrderByRow';
import { SQLWhereRow } from './SQLWhereRow';
import { SelectRow } from './SelectRow';

export interface SqlQueryBuilderProps {
  db: SQLQueryBuilderDB;
  query: SQLQuery;
  onChange: (query: SQLQuery) => void;
  queryRowFilter?: Partial<QueryRowFilter>;
  /** Render plugin-owned validation or other controls. */
  children?: ReactNode;
}

export function SqlQueryBuilder({
  query: inputQuery,
  db,
  queryRowFilter: rows,
  onChange,
  children,
}: SqlQueryBuilderProps) {
  const query = useMemo(() => ({ ...inputQuery, sql: inputQuery.sql ?? applyQueryDefaults().sql }), [inputQuery]);
  const queryRowFilter = { filter: true, group: true, order: true, preview: true, ...rows };
  const queryRef = useRef(query);
  useEffect(() => {
    queryRef.current = query;
  }, [query]);
  const { dataset, table } = query;
  // Column discovery depends on the selected relation, not on every builder edit.
  const state = useAsync(async () => {
    const fields = await db.fields({ ...queryRef.current, dataset, table });
    return fields;
  }, [db, dataset, table]);

  return (
    <>
      <EditorRows>
        <EditorRow>
          <SelectRow columns={state.value || []} query={query} onQueryChange={onChange} db={db} />
        </EditorRow>
        {queryRowFilter.filter && (
          <EditorRow>
            <EditorField
              label={t('grafana-sql.components.visual-editor.label-filter-by-column-value', 'Filter by column value')}
              optional
            >
              <SQLWhereRow fields={state.value || []} query={query} onQueryChange={onChange} db={db} />
            </EditorField>
          </EditorRow>
        )}
        {queryRowFilter.group && (
          <EditorRow>
            <EditorField label={t('grafana-sql.components.visual-editor.label-group-by-column', 'Group by column')}>
              <SQLGroupByRow fields={state.value || []} query={query} onQueryChange={onChange} db={db} />
            </EditorField>
          </EditorRow>
        )}
        {queryRowFilter.order && (
          <EditorRow>
            <SQLOrderByRow fields={state.value || []} query={query} onQueryChange={onChange} db={db} />
          </EditorRow>
        )}
        {queryRowFilter.preview && query.rawSql && (
          <EditorRow>
            <Preview rawSql={query.rawSql} datasourceType={query.datasource?.type} />
          </EditorRow>
        )}
      </EditorRows>
      {children}
    </>
  );
}
