import { css, cx } from '@emotion/css';
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

import { LogRows } from '../LogRows';

import { LoadMoreOptions, LogContextButtons } from './LogContextButtons';

export interface RowContextOptions {
  direction?: 'BACKWARD' | 'FORWARD';
  limit?: number;
}

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
      display: inline-table;
      position: sticky;
      z-index: 1;
      top: -1px;
      bottom: -1px;
      padding: ${theme.spacing(1)} 0 ${theme.spacing(1)} 0;
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
    logRowGroup: css`
      width: 100%;
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
  onClose: close,
  getRowContext,
  timeZone,
}) => {
  const scrollElement = React.createRef<HTMLDivElement>();
  const entryElement = React.createRef<HTMLDivElement>();

  const theme = useTheme2();
  const { modal, flexColumn, flexRow, entry, datasourceUi, logRowGroup, logRowGroups, noMarginBottom } =
    getStyles(theme);
  const [context, setContext] = useState<{ after: LogRowModel[]; before: LogRowModel[] }>({ after: [], before: [] });
  const [limit, setLimit] = useState<number>(LoadMoreOptions[0].value!);
  const [loadMoreOption, setLoadMoreOption] = useState<SelectableValue<number>>(LoadMoreOptions[0]);

  const onChangeLimitOption = (option: SelectableValue<number>) => {
    setLoadMoreOption(option);
  };

  const onAddLimit = () => {
    if (loadMoreOption.value) {
      setLimit(limit + loadMoreOption.value);
    }
  };

  const onRemoveLimit = () => {
    if (loadMoreOption.value) {
      setLimit(limit - loadMoreOption.value);
    }
  };

  const [_, fetchResults] = useAsyncFn(async () => {
    if (open && row && limit) {
      const rawResults = await Promise.all([
        getRowContext(row, {
          limit: limit,
        }),
        getRowContext(row, {
          // The start time is inclusive so we will get the one row we are using as context entry
          limit: limit + 1,
          direction: 'FORWARD',
        }),
      ]);

      const logsModels = rawResults.map((result) => {
        return dataFrameToLogsModel(result.data);
      });

      setContext({
        after: logsModels[0].rows.reverse(),
        before: logsModels[1].rows.reverse(),
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
    <Modal isOpen={open} title="Log context" contentClassName={flexColumn} className={modal} onDismiss={close}>
      {config.featureToggles.logsContextDatasourceUi && getLogRowContextUi && (
        <div className={datasourceUi}>{getLogRowContextUi(row, fetchResults)}</div>
      )}
      <div className={flexRow}>
        <div>
          Showing {limit} lines {logsSortOrder === LogsSortOrder.Descending ? 'after' : 'before'} match
        </div>
        <div>
          <LogContextButtons
            onRemoveClick={onRemoveLimit}
            onAddClick={onAddLimit}
            onChangeOption={onChangeLimitOption}
            option={loadMoreOption}
          />
        </div>
      </div>
      <div ref={scrollElement} className={logRowGroups}>
        <div className={cx(logRowGroup, noMarginBottom)}>
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
        </div>

        <div ref={entryElement} className={cx(entry, logRowGroup, noMarginBottom)}>
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
        </div>
        <div className={logRowGroup}>
          <LogRows
            logRows={context.before}
            dedupStrategy={LogsDedupStrategy.none}
            showLabels={store.getBool(SETTINGS_KEYS.showLabels, false)}
            showTime={store.getBool(SETTINGS_KEYS.showTime, true)}
            wrapLogMessage={store.getBool(SETTINGS_KEYS.wrapLogMessage, true)}
            prettifyLogMessage={store.getBool(SETTINGS_KEYS.prettifyLogMessage, false)}
            enableLogDetails={true}
            timeZone={'UTC'}
            displayedFields={displayedFields}
            onClickShowField={showField}
            onClickHideField={hideField}
          />
        </div>
      </div>
      <div>
        <div>
          Showing {limit} lines {logsSortOrder === LogsSortOrder.Ascending ? 'after' : 'before'} match
        </div>
      </div>
    </Modal>
  );
};
