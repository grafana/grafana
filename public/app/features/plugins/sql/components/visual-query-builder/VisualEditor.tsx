import React from 'react';
import { useAsync } from 'react-use';

import { EditorRows, EditorRow, EditorField } from '@grafana/experimental';

import { DB, QueryEditorProps, QueryRowFilter } from '../../types';
import { QueryToolbox } from '../query-editor-raw/QueryToolbox';

import { Preview } from './Preview';
import { SQLGroupByRow } from './SQLGroupByRow';
import { SQLOrderByRow } from './SQLOrderByRow';
import { SQLSelectRow } from './SQLSelectRow';
import { SQLWhereRow } from './SQLWhereRow';

interface VisualEditorProps extends QueryEditorProps {
  db: DB;
  queryRowFilter: QueryRowFilter;
  onValidate: (isValid: boolean) => void;
}

export const VisualEditor = ({ query, db, queryRowFilter, onChange, onValidate, range }: VisualEditorProps) => {
  const state = useAsync(async () => {
    const fields = await db.fields(query);
    return fields;
  }, [db, query.dataset, query.table]);

  return (
    <>
      <EditorRows>
        <EditorRow>
          <SQLSelectRow fields={state.value || []} query={query} onQueryChange={onChange} db={db} />
        </EditorRow>
        {queryRowFilter.filter && (
          <EditorRow>
            <EditorField label="Filter by column value" optional>
              <SQLWhereRow fields={state.value || []} query={query} onQueryChange={onChange} db={db} />
            </EditorField>
          </EditorRow>
        )}
        {queryRowFilter.group && (
          <EditorRow>
            <EditorField label="Group by column">
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
            <Preview rawSql={query.rawSql} />
          </EditorRow>
        )}
      </EditorRows>
      <QueryToolbox db={db} query={query} onValidate={onValidate} range={range} />
    </>
  );
};
