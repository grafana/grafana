import { css } from '@emotion/css';
import { useState } from 'react';

import {
  CoreApp,
  getDataSourceRef,
  getNextRefId,
  type DataSourceInstanceSettings,
  type PanelData,
  type TimeRange,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  getDataSourceInstance,
  getDataSourceInstanceSettings,
  useDataSourceInstanceSettings,
} from '@grafana/runtime/unstable';
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

  const onChangeDataSource = async (settings: DataSourceInstanceSettings) => {
    setIsOpen(true);

    const dataSourceRef = getDataSourceRef(settings);
    const previous = query.datasource ? await getDataSourceInstanceSettings(query.datasource) : undefined;
    const updated =
      previous?.type === settings.type
        ? { ...query, datasource: dataSourceRef }
        : {
            ...(await getDataSourceInstance(dataSourceRef)).getDefaultQuery?.(CoreApp.Notebook),
            ...query,
            datasource: dataSourceRef,
          };

    applyQueries(
      cell,
      queryRunner,
      queries.map((q, i) => (i === index ? updated : q)),
      t('notebooks.history.switch-datasource', 'Switch datasource')
    );
  };

  const onReplaceQuery = (replacement: DataQuery) => {
    applyQueries(
      cell,
      queryRunner,
      queries.map((q, i) => (i === index ? { ...replacement, refId: query.refId } : q)),
      t('notebooks.history.select-query', 'Select query')
    );
  };

  const onReplaceQueries = (replacements: DataQuery[]) => {
    if (replacements.length === 0) {
      return;
    }

    const newQueries = [...queries];
    const staged: DataQuery[] = [];
    replacements.forEach((replacement, i) => {
      if (i === 0) {
        staged.push({ ...replacement, refId: query.refId });
      } else {
        const taken = [...newQueries.filter((_, qi) => qi !== index), ...staged];
        staged.push({ ...replacement, refId: getNextRefId(taken) });
      }
    });
    newQueries.splice(index, 1, ...staged);

    applyQueries(cell, queryRunner, newQueries, t('notebooks.history.select-query', 'Select query'));
  };

  if (!dsSettings) {
    return <DataSourcePicker current={query.datasource} onChange={onChangeDataSource} />;
  }

  const isOnlyQuery = queries.length <= 1;

  return (
    <div className={isOnlyQuery ? styles.hideRemoveButton : undefined}>
      <QueryEditorRow
        data={data}
        query={query}
        queries={queries}
        id={query.refId}
        index={index}
        dataSource={dsSettings}
        app={CoreApp.Notebook}
        onChangeDataSource={onChangeDataSource}
        onChange={onChangeQuery}
        onReplace={onReplaceQuery}
        onReplaceQueries={onReplaceQueries}
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
        draggable={false}
        onQueryOpenChanged={() => {
          setIsOpen(true);
        }}
        onQueryClosed={() => {
          setIsOpen(false);
        }}
      />
    </div>
  );
}

function getStyles() {
  return {
    hideRemoveButton: css({
      '&& button:has([data-testid="icon-trash-alt"])': {
        visibility: 'hidden',
      },
    }),
  };
}
