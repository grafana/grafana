import { css } from '@emotion/css';
import { useState } from 'react';

import { type DataSourceInstanceSettings, type PanelData, type TimeRange } from '@grafana/data';
import { useDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { type SceneQueryRunner } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';
import { useStyles2 } from '@grafana/ui';
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
  /** Starts this row open instead of collapsed — see PanelQueryEditor's own doc comment on autoFocus. */
  startOpen?: boolean;
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
export function PanelQueryEditorRow({ queryRunner, queries, query, index, data, range, onRunQuery, startOpen }: Props) {
  const { settings: dsSettings } = useDataSourceInstanceSettings(query.datasource);
  // Hides the row's own drag-to-reorder handle: reordering isn't supported here
  const styles = useStyles2(getStyles);
  const [isOpen, setIsOpen] = useState(Boolean(startOpen));

  const onChangeQuery = (updated: DataQuery) => {
    setQueryRunnerQueries(
      queryRunner,
      queries.map((q, i) => (i === index ? updated : q))
    );
  };

  const onChangeDataSource = (settings: DataSourceInstanceSettings) => {
    onChangeQuery({ ...query, datasource: { uid: settings.uid, type: settings.type } });
    setIsOpen(true);
  };

  if (!dsSettings) {
    return <DataSourcePicker current={query.datasource} onChange={onChangeDataSource} />;
  }

  return (
    <div className={styles.hideDragHandle}>
      <QueryEditorRow
        data={data}
        query={query}
        queries={queries}
        id={query.refId}
        index={index}
        dataSource={dsSettings}
        onChangeDataSource={onChangeDataSource}
        onChange={onChangeQuery}
        onRunQuery={onRunQuery}
        onAddQuery={(copy) => setQueryRunnerQueries(queryRunner, addQuery(queries, copy))}
        onRemoveQuery={(target) => {
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
        onQueryOpenChanged={() => {
          setIsOpen(true);
        }}
      />
    </div>
  );
}

function getStyles() {
  return {
    hideDragHandle: css({
      '&& div:has(> [data-testid="icon-draggabledots"])': {
        display: 'none',
      },
    }),
  };
}
