import React from 'react';
import { useAsync } from 'react-use';

import { EditorRow, EditorRows } from '@grafana/experimental';
import { OptionsPaneCategory } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategory';

import { DB, QueryEditorProps, QueryRowFilter } from '../../types';
import { QueryToolbox } from '../query-editor-raw/QueryToolbox';

import { Preview } from './Preview';
import { SQLGroupByRow } from './SQLGroupByRow';
import { SQLOrderByRow } from './SQLOrderByRow';
import { SQLSelectRow } from './SQLSelectRow';
import { SQLTimeSeriesSelectRow } from './SQLTimeSeriesSelectRow';
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
  const state = useAsync(async () => {
    const fields = await db.fields(query);
    return fields;
  }, [db, query.dataset, query.table]);

  return (
    <>
      <EditorRows>
        {query.format === 'table' && (
          <>
            <EditorRow>
              <SQLSelectRow fields={state.value || []} query={query} onQueryChange={onChange} />
            </EditorRow>
            <EditorRow>
              <OptionsPaneCategory id="filter-by-column-value" title="Filter by column value" isOpenDefault={false}>
                <SQLWhereRow fields={state.value || []} query={query} onQueryChange={onChange} />
              </OptionsPaneCategory>
            </EditorRow>
            <EditorRow>
              <OptionsPaneCategory id="group-by-column" title="Group by column" isOpenDefault={false}>
                <SQLGroupByRow fields={state.value || []} query={query} onQueryChange={onChange} />
              </OptionsPaneCategory>
            </EditorRow>
          </>
        )}
        {query.format === 'time_series' && (
          <EditorRow>
            <SQLTimeSeriesSelectRow fields={state.value || []} query={query} onQueryChange={onChange} />
          </EditorRow>
        )}
        <EditorRow>
          <SQLOrderByRow fields={state.value || []} query={query} onQueryChange={onChange} />
        </EditorRow>
        {/* {queryRowFilter.filter && (
        <EditorRow>
          <EditorField label="Filter by column value" optional>
            <SQLWhereRow fields={state.value || []} query={query} onQueryChange={onChange} />
          </EditorField>
        </EditorRow>
      )} */}
        {/* {queryRowFilter.group && (
        <EditorRow>
          <EditorField label="Group by column">
            <SQLGroupByRow fields={state.value || []} query={query} onQueryChange={onChange} />
          </EditorField>
        </EditorRow>
      )} */}
        {/* {queryRowFilter.order && (
        <EditorRow>
          <SQLOrderByRow fields={state.value || []} query={query} onQueryChange={onChange} />
        </EditorRow>
      )} */}
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
