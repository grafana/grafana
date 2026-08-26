import { css, cx } from '@emotion/css';
import { useState } from 'react';

import { type DataSourceInstanceSettings, type PanelData, type TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { type SceneQueryRunner } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';
import { useStyles2 } from '@grafana/ui';
import { addQuery } from 'app/core/utils/query';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { QueryEditorRow } from 'app/features/query/components/QueryEditorRow';

import { type NotebookCellItem } from './NotebookCellItem';
import { applyQueries } from './applyQueries';

interface Props {
  /** See PanelQueryEditor's own `cell` prop doc comment. */
  cell?: NotebookCellItem;
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
 * the real row. Each row resolves and displays its own query's datasource independently, unlike
 * dashboard panel editing's shared group selector. Every write still goes through applyQueries,
 * which keeps the runner-level datasource (what actually decides where a query runs) correct
 * underneath and records the edit on the notebook's undo/redo stack when a cell is known.
 */
export function PanelQueryEditorRow({
  cell,
  queryRunner,
  queries,
  query,
  index,
  data,
  range,
  onRunQuery,
  startOpen,
}: Props) {
  const { settings: dsSettings } = useDataSourceInstanceSettings(query.datasource);
  const styles = useStyles2(getStyles);
  const [isOpen, setIsOpen] = useState(Boolean(startOpen));

  const onChangeQuery = (updated: DataQuery) => {
    applyQueries(
      cell,
      queryRunner,
      queries.map((q, i) => (i === index ? updated : q))
    );
  };

  const onChangeDataSource = (settings: DataSourceInstanceSettings) => {
    const updated = { ...query, datasource: { uid: settings.uid, type: settings.type } };
    applyQueries(
      cell,
      queryRunner,
      queries.map((q, i) => (i === index ? updated : q)),
      t('notebooks.history.switch-datasource', 'Switch datasource')
    );
    setIsOpen(true);
  };

  if (!dsSettings) {
    return <DataSourcePicker current={query.datasource} onChange={onChangeDataSource} />;
  }

  const isOnlyQuery = queries.length <= 1;

  return (
    <div className={cx(styles.hideDragHandle, isOnlyQuery && styles.hideRemoveButton)}>
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
        onAddQuery={(copy) =>
          applyQueries(
            cell,
            queryRunner,
            addQuery(queries, copy),
            t('notebooks.history.duplicate-query', 'Duplicate query')
          )
        }
        onRemoveQuery={(target) => {
          if (isOnlyQuery) {
            return;
          }
          applyQueries(
            cell,
            queryRunner,
            queries.filter((q) => q !== target),
            t('notebooks.history.remove-query', 'Remove query')
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
    hideRemoveButton: css({
      '&& div:has(+ div > [data-testid="icon-draggabledots"])': {
        visibility: 'hidden',
      },
    }),
  };
}
