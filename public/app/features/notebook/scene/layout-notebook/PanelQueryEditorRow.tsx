import { useState } from 'react';

import { type DataQuery, type DataSourceInstanceSettings, type PanelData, type TimeRange } from '@grafana/data';
import { useDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { type SceneQueryRunner } from '@grafana/scenes';
import { addQuery } from 'app/core/utils/query';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { QueryEditorRow } from 'app/features/query/components/QueryEditorRow';

import { setQueryRunnerQueries } from './setQueryRunnerQueries';

interface Props {
  queryRunner: SceneQueryRunner;
  queries: DataQuery[];
  query: DataQuery;
  index: number;
  data: PanelData;
  range: TimeRange;
  onRunQuery: () => void;
}

/**
 * One row of the notebook panel's inline query editor — datasource picker until one resolves, then
 * the real row. Each row resolves and displays its own query's datasource independently rather than
 * through one shared group selector the way dashboard panel editing's QueryEditorRows does — every
 * row here already worked this way before multi-query support existed, and repeating it keeps this
 * editor's UI simple. Every query-array write still goes through setQueryRunnerQueries, though, so the
 * runner-level datasource (what actually decides where a query runs, independent of what a row
 * displays — see that function's own comment) stays correct underneath.
 */
export function PanelQueryEditorRow({ queryRunner, queries, query, index, data, range, onRunQuery }: Props) {
  const { settings: dsSettings } = useDataSourceInstanceSettings(query.datasource);
  // Starts collapsed: entering edit mode with several rows already open at once would otherwise
  // dominate the notebook cell before the reader has asked to look at any of them. Local state, not
  // derived from anything persisted — PanelQueryEditorRow only mounts while editing, so a fresh mount
  // (including re-entering edit mode after leaving it) naturally starts collapsed again.
  const [isOpen, setIsOpen] = useState(false);

  const changeQuery = (updated: DataQuery) => {
    setQueryRunnerQueries(
      queryRunner,
      queries.map((q, i) => (i === index ? updated : q))
    );
  };

  const changeDataSource = (settings: DataSourceInstanceSettings) => {
    changeQuery({ ...query, datasource: { uid: settings.uid, type: settings.type } });
  };

  if (!dsSettings) {
    return <DataSourcePicker current={query.datasource} onChange={changeDataSource} />;
  }

  return (
    <QueryEditorRow
      data={data}
      query={query}
      queries={queries}
      id={query.refId}
      index={index}
      dataSource={dsSettings}
      onChangeDataSource={changeDataSource}
      onChange={changeQuery}
      onRunQuery={onRunQuery}
      // Real handlers, not no-ops, now that a panel can carry more than one query: onCopyQuery
      // (the row's own "Duplicate query" action) already calls onAddQuery(cloneDeep(query)) — same
      // addQuery() the header's own "Add query" button uses, so the clone still gets a fresh refId
      // rather than colliding with the query it was copied from.
      onAddQuery={(copy) => setQueryRunnerQueries(queryRunner, addQuery(queries, copy))}
      onRemoveQuery={(target) => {
        // Refuses to go to zero queries — the rest of the editor (and the panel itself) assumes
        // there's always at least one, same invariant a freshly-created query panel starts with.
        if (queries.length <= 1) {
          return;
        }
        setQueryRunnerQueries(
          queryRunner,
          queries.filter((q) => q !== target)
        );
      }}
      range={range}
      collapsable
      isOpen={isOpen}
      onQueryOpenChanged={(open) => setIsOpen(Boolean(open))}
    />
  );
}
