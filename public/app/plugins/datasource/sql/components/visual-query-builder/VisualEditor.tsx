import React from 'react';

import { EditorField, EditorRow, EditorRows } from '@grafana/experimental';

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

export const VisualEditor: React.FC<VisualEditorProps> = ({
  query,
  db,
  queryRowFilter,
  onChange,
  onValidate,
  range,
}) => {
  return (
    <>
      <EditorRows>
        <EditorRow>
          <SQLSelectRow db={db} query={query} onQueryChange={onChange} />
        </EditorRow>
        {queryRowFilter.filter && (
          <EditorRow>
            <EditorField label="Filter by column value" optional>
              <SQLWhereRow db={db} query={query} onQueryChange={onChange} />
            </EditorField>
          </EditorRow>
        )}
        {queryRowFilter.group && (
          <EditorRow>
            <EditorField label="Group by column">
              <SQLGroupByRow db={db} query={query} onQueryChange={onChange} />
            </EditorField>
          </EditorRow>
        )}
        {queryRowFilter.order && (
          <EditorRow>
            <SQLOrderByRow db={db} query={query} onQueryChange={onChange} />
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
