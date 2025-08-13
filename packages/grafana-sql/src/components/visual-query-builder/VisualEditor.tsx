import { useAsync } from 'react-use';

import { t } from '@grafana/i18n';
import { EditorRows, EditorRow, EditorField } from '@grafana/plugin-ui';

import { DB, QueryEditorProps, QueryRowFilter } from '../../types';
import { QueryToolbox } from '../query-editor-raw/QueryToolbox';

import { Preview } from './Preview';
import { SQLGroupByRow } from './SQLGroupByRow';
import { SQLOrderByRow } from './SQLOrderByRow';
import { SQLWhereRow } from './SQLWhereRow';
import { SelectRow } from './SelectRow';

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
      <QueryToolbox db={db} query={query} onValidate={onValidate} range={range} />
    </>
  );
};
