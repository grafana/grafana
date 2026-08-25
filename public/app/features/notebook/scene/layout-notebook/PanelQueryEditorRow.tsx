import { css } from '@emotion/css';
import { useState } from 'react';

import {
  type DataQuery,
  type DataSourceInstanceSettings,
  type GrafanaTheme2,
  type PanelData,
  type TimeRange,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { useDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { type SceneQueryRunner } from '@grafana/scenes';
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
  // Hides the row's own drag-to-reorder handle: reordering isn't supported here (see
  // setQueryRunnerQueries's own notes on scope), and QueryEditorRow only exposes draggable bundled
  // with hideActionButtons/inSavedQueryMode — both of which would also hide the duplicate/hide/remove
  // actions this editor does want. Targeted by its own aria-label (kept in sync with QueryOperationRowHeader's,
  // since it comes from the same translation key) rather than an unexported style, so it still finds the
  // handle in any locale.
  const dragAndDropLabel = t('query-operation.header.drag-and-drop', 'Drag and drop to reorder');
  const styles = useStyles2(getStyles, dragAndDropLabel);
  // Collapsed by default: entering edit mode with several rows already open at once would otherwise
  // dominate the notebook cell before the reader has asked to look at any of them. `startOpen` is the
  // one exception — a block the reader just added or converted, where making them click a chevron to
  // see the editor they were just handed would be a needless extra step. Local state either way, not
  // derived from anything persisted — PanelQueryEditorRow only mounts while editing, so a fresh mount
  // (including re-entering edit mode after leaving it) starts from this same initial value again.
  const [isOpen, setIsOpen] = useState(Boolean(startOpen));

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
    return (
      <DataSourcePicker
        current={query.datasource}
        onChange={(settings) => {
          changeDataSource(settings);
          // The row that was just a bare picker a moment ago now has a real editor behind it —
          // opening it automatically means the reader who just picked a datasource sees it right
          // away, instead of also having to find and click a chevron.
          setIsOpen(true);
        }}
      />
    );
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
    </div>
  );
}

function getStyles(_theme: GrafanaTheme2, dragAndDropLabel: string) {
  return {
    hideDragHandle: css({
      [`[aria-label="${dragAndDropLabel}"]`]: {
        display: 'none',
      },
    }),
  };
}
