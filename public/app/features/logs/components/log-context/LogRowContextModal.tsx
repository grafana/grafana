import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import { useAsyncFn } from 'react-use';

import {
  DataQueryResponse,
  DataSourceWithLogsContextSupport,
  GrafanaTheme2,
  LogRowModel,
  LogsDedupStrategy,
  LogsSortOrder,
  SelectableValue,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { Modal, useTheme2 } from '@grafana/ui';
import { dataFrameToLogsModel } from 'app/core/logsModel';
import store from 'app/core/store';
import { SETTINGS_KEYS } from 'app/features/explore/utils/logs';
import { LokiQueryDirection } from 'app/plugins/datasource/loki/dataquery.gen';

import { LogRows } from '../LogRows';

import { LoadMoreOptions, LogContextButtons } from './LogContextButtons';
import { RowContextOptions } from './types';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    modal: css`
      width: 85vw;
      ${theme.breakpoints.down('md')} {
        width: 100%;
      }
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    `,
    entry: css`
      position: sticky;
      z-index: 1;
      top: -1px;
      bottom: -1px;
      & > td {
        padding: ${theme.spacing(1)} 0 ${theme.spacing(1)} 0;
      }
      background: ${theme.colors.emphasize(theme.colors.background.secondary)};

      & > table {
        margin-bottom: 0;
      }
    `,
    datasourceUi: css`
      padding-bottom: ${theme.spacing(1.25)};
      display: flex;
      align-items: center;
    `,
    logRowGroups: css`
      overflow: scroll;
      max-height: 75%;
      align-self: stretch;
      display: inline-block;
    `,
    flexColumn: css`
      display: flex;
      flex-direction: column;
    `,
    flexRow: css`
      display: flex;
      flex-direction: row;
      & > div:last-child {
        margin-left: auto;
      }
    `,
    noMarginBottom: css`
      & > table {
        margin-bottom: 0;
      }
    `,
  };
};

export enum LogGroupPosition {
  Bottom = 'bottom',
  Top = 'top',
}

interface LogRowContextModalProps {
  row: LogRowModel;
  open: boolean;
  timeZone: string;
  onClose: () => void;
  getRowContext: (row: LogRowModel, options?: RowContextOptions) => Promise<DataQueryResponse>;
  logsSortOrder?: LogsSortOrder | null;
  runContextQuery?: () => void;
  getLogRowContextUi?: DataSourceWithLogsContextSupport['getLogRowContextUi'];
}

export const LogRowContextModal: React.FunctionComponent<LogRowContextModalProps> = ({
  row,
  open,
  logsSortOrder,
  getLogRowContextUi,
  onClose,
  getRowContext,
  timeZone,
}) => {
  const scrollElement = React.createRef<HTMLDivElement>();
  const entryElement = React.createRef<HTMLTableRowElement>();

  const theme = useTheme2();
  const { modal, flexColumn, flexRow, entry, datasourceUi, logRowGroups, noMarginBottom } = getStyles(theme);
  const [context, setContext] = useState<{ after: LogRowModel[]; before: LogRowModel[] }>({ after: [], before: [] });
  const [limit, setLimit] = useState<number>(LoadMoreOptions[0].value!);
  const [loadMoreOption, setLoadMoreOption] = useState<SelectableValue<number>>(LoadMoreOptions[0]);

  const onChangeLimitOption = (option: SelectableValue<number>) => {
    setLoadMoreOption(option);
    setLimit(option.value!);
  };

  const [_, fetchResults] = useAsyncFn(async () => {
    if (open && row && limit) {
      const rawResults = await Promise.all([
        getRowContext(row, {
          limit: logsSortOrder === LogsSortOrder.Descending ? limit + 1 : limit,
          direction:
            logsSortOrder === LogsSortOrder.Descending ? LokiQueryDirection.Forward : LokiQueryDirection.Backward,
        }),
        getRowContext(row, {
          limit: logsSortOrder === LogsSortOrder.Ascending ? limit + 1 : limit,
          direction:
            logsSortOrder === LogsSortOrder.Ascending ? LokiQueryDirection.Forward : LokiQueryDirection.Backward,
        }),
      ]);

      const logsModels = rawResults.map((result) => {
        return dataFrameToLogsModel(result.data);
      });

      const afterRows = logsSortOrder === LogsSortOrder.Ascending ? logsModels[0].rows.reverse() : logsModels[0].rows;
      const beforeRows = logsSortOrder === LogsSortOrder.Ascending ? logsModels[1].rows.reverse() : logsModels[1].rows;

      setContext({
        after: afterRows.filter((r) => {
          return r.timeEpochNs !== row.timeEpochNs && r.entry !== row.entry;
        }),
        before: beforeRows.filter((r) => {
          return r.timeEpochNs !== row.timeEpochNs && r.entry !== row.entry;
        }),
      });
    } else {
      setContext({ after: [], before: [] });
    }
  }, [row, open, limit]);

  useEffect(() => {
    if (open) {
      fetchResults();
    }
  }, [fetchResults, open]);

  const [displayedFields, setDisplayedFields] = useState<string[]>([]);

  const showField = (key: string) => {
    const index = displayedFields.indexOf(key);

    if (index === -1) {
      setDisplayedFields([...displayedFields, key]);
    }
  };

  const hideField = (key: string) => {
    const index = displayedFields.indexOf(key);

    if (index > -1) {
      displayedFields.splice(index, 1);
      setDisplayedFields([...displayedFields]);
    }
  };

  return (
    <Modal isOpen={open} title="Log context" contentClassName={flexColumn} className={modal} onDismiss={onClose}>
      {config.featureToggles.logsContextDatasourceUi && getLogRowContextUi && (
        <div className={datasourceUi}>{getLogRowContextUi(row, fetchResults)}</div>
      )}
      <div className={flexRow}>
        <div>{/* Showing {limit} lines {logsSortOrder === LogsSortOrder.Descending ? 'after' : 'before'} match */}</div>
        <div>
          <LogContextButtons onChangeOption={onChangeLimitOption} option={loadMoreOption} />
        </div>
      </div>
      <div ref={scrollElement} className={logRowGroups}>
        <table>
          <tr>
            <td className={noMarginBottom}>
              <LogRows
                logRows={context.after}
                dedupStrategy={LogsDedupStrategy.none}
                showLabels={store.getBool(SETTINGS_KEYS.showLabels, false)}
                showTime={store.getBool(SETTINGS_KEYS.showTime, true)}
                wrapLogMessage={store.getBool(SETTINGS_KEYS.wrapLogMessage, true)}
                prettifyLogMessage={store.getBool(SETTINGS_KEYS.prettifyLogMessage, false)}
                enableLogDetails={true}
                timeZone={timeZone}
                displayedFields={displayedFields}
                onClickShowField={showField}
                onClickHideField={hideField}
              />
            </td>
          </tr>
          <tr ref={entryElement} className={entry}>
            <td className={noMarginBottom}>
              <LogRows
                logRows={[row]}
                dedupStrategy={LogsDedupStrategy.none}
                showLabels={store.getBool(SETTINGS_KEYS.showLabels, false)}
                showTime={store.getBool(SETTINGS_KEYS.showTime, true)}
                wrapLogMessage={store.getBool(SETTINGS_KEYS.wrapLogMessage, true)}
                prettifyLogMessage={store.getBool(SETTINGS_KEYS.prettifyLogMessage, false)}
                enableLogDetails={true}
                timeZone={timeZone}
                displayedFields={displayedFields}
                onClickShowField={showField}
                onClickHideField={hideField}
              />
            </td>
          </tr>
          <tr>
            <td>
              <LogRows
                logRows={context.before}
                dedupStrategy={LogsDedupStrategy.none}
                showLabels={store.getBool(SETTINGS_KEYS.showLabels, false)}
                showTime={store.getBool(SETTINGS_KEYS.showTime, true)}
                wrapLogMessage={store.getBool(SETTINGS_KEYS.wrapLogMessage, true)}
                prettifyLogMessage={store.getBool(SETTINGS_KEYS.prettifyLogMessage, false)}
                enableLogDetails={true}
                timeZone={timeZone}
                displayedFields={displayedFields}
                onClickShowField={showField}
                onClickHideField={hideField}
              />
            </td>
          </tr>
        </table>
      </div>
      <div>
        <div>{/* Showing {limit} lines {logsSortOrder === LogsSortOrder.Ascending ? 'after' : 'before'} match */}</div>
      </div>
    </Modal>
  );
};
