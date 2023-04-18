import { css, cx } from '@emotion/css';
import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { useAsyncFn } from 'react-use';

import {
  DataQueryResponse,
  DataSourceWithLogsContextSupport,
  GrafanaTheme2,
  LogRowContextOptions,
  LogRowContextQueryDirection,
  LogRowModel,
  LogsDedupStrategy,
  LogsSortOrder,
  SelectableValue,
  rangeUtil,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { DataQuery, TimeZone } from '@grafana/schema';
import { Button, LoadingBar, Modal, useTheme2 } from '@grafana/ui';
import { dataFrameToLogsModel } from 'app/core/logsModel';
import store from 'app/core/store';
import { splitOpen } from 'app/features/explore/state/main';
import { SETTINGS_KEYS } from 'app/features/explore/utils/logs';
import { useDispatch } from 'app/types';

import { LogRows } from '../LogRows';

import { LoadMoreOptions, LogContextButtons } from './LogContextButtons';

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
      overflow: auto;
      max-height: 75%;
      align-self: stretch;
      display: inline-block;
      & > table {
        min-width: 100%;
      }
    `,
    flexColumn: css`
      display: flex;
      flex-direction: column;
      padding: 0 ${theme.spacing(3)} ${theme.spacing(3)} ${theme.spacing(3)};
    `,
    flexRow: css`
      display: flex;
      flex-direction: row;
      align-items: center;
      & > div:last-child {
        margin-left: auto;
      }
    `,
    noMarginBottom: css`
      & > table {
        margin-bottom: 0;
      }
    `,
    hidden: css`
      display: none;
    `,
    paddingTop: css`
      padding-top: ${theme.spacing(1)};
    `,
    paddingBottom: css`
      padding-bottom: ${theme.spacing(1)};
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
  timeZone: TimeZone;
  onClose: () => void;
  getRowContext: (row: LogRowModel, options?: LogRowContextOptions) => Promise<DataQueryResponse>;

  getRowContextQuery?: (row: LogRowModel, options?: LogRowContextOptions) => Promise<DataQuery | null>;
  logsSortOrder?: LogsSortOrder | null;
  runContextQuery?: () => void;
  getLogRowContextUi?: DataSourceWithLogsContextSupport['getLogRowContextUi'];
}

export const LogRowContextModal: React.FunctionComponent<LogRowContextModalProps> = ({
  row,
  open,
  logsSortOrder,
  timeZone,
  getLogRowContextUi,
  getRowContextQuery,
  onClose,
  getRowContext,
}) => {
  const scrollElement = React.createRef<HTMLDivElement>();
  const entryElement = React.createRef<HTMLTableRowElement>();
  // We can not use `entryElement` to scroll to the right element because it's
  // sticky. That's why we add another row and use this ref to scroll to that
  // first.
  const preEntryElement = React.createRef<HTMLTableRowElement>();

  const dispatch = useDispatch();
  const theme = useTheme2();
  const styles = getStyles(theme);
  const [context, setContext] = useState<{ after: LogRowModel[]; before: LogRowModel[] }>({ after: [], before: [] });
  const [limit, setLimit] = useState<number>(LoadMoreOptions[0].value!);
  const [loadingWidth, setLoadingWidth] = useState(0);
  const [loadMoreOption, setLoadMoreOption] = useState<SelectableValue<number>>(LoadMoreOptions[0]);

  const getFullTimerange = useCallback(() => {
    const { before, after } = context;
    const allRows = [...before, row, ...after].sort((a, b) => a.timeEpochMs - b.timeEpochMs);
    const first = allRows[0];
    const last = allRows[allRows.length - 1];
    return rangeUtil.convertRawToRange(
      {
        from: first.timeUtc,
        to: last.timeUtc,
      },
      'utc'
    );
  }, [context, row]);

  const onChangeLimitOption = (option: SelectableValue<number>) => {
    setLoadMoreOption(option);
    setLimit(option.value!);
  };

  const [{ loading }, fetchResults] = useAsyncFn(async () => {
    if (open && row && limit) {
      const rawResults = await Promise.all([
        getRowContext(row, {
          limit: logsSortOrder === LogsSortOrder.Descending ? limit + 1 : limit,
          direction:
            logsSortOrder === LogsSortOrder.Descending
              ? LogRowContextQueryDirection.Forward
              : LogRowContextQueryDirection.Backward,
        }),
        getRowContext(row, {
          limit: logsSortOrder === LogsSortOrder.Ascending ? limit + 1 : limit,
          direction:
            logsSortOrder === LogsSortOrder.Ascending
              ? LogRowContextQueryDirection.Forward
              : LogRowContextQueryDirection.Backward,
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

  useLayoutEffect(() => {
    if (!loading && entryElement.current && preEntryElement.current) {
      preEntryElement.current.scrollIntoView({ block: 'center' });
      entryElement.current.scrollIntoView({ block: 'center' });
    }
  }, [entryElement, preEntryElement, context, loading]);

  useLayoutEffect(() => {
    const width = scrollElement?.current?.parentElement?.clientWidth;
    if (width && width > 0) {
      setLoadingWidth(width);
    }
  }, [scrollElement]);

  return (
    <Modal
      isOpen={open}
      title="Log context"
      contentClassName={styles.flexColumn}
      className={styles.modal}
      onDismiss={onClose}
    >
      {config.featureToggles.logsContextDatasourceUi && getLogRowContextUi && (
        <div className={styles.datasourceUi}>{getLogRowContextUi(row, fetchResults)}</div>
      )}
      <div className={cx(styles.flexRow, styles.paddingBottom)}>
        <div className={loading ? styles.hidden : ''}>
          Showing {context.after.length} lines {logsSortOrder === LogsSortOrder.Ascending ? 'after' : 'before'} match.
        </div>
        <div>
          <LogContextButtons onChangeOption={onChangeLimitOption} option={loadMoreOption} />
        </div>
      </div>
      <div className={loading ? '' : styles.hidden}>
        <LoadingBar width={loadingWidth} />
      </div>
      <div ref={scrollElement} className={styles.logRowGroups}>
        <table>
          <tbody>
            <tr>
              <td className={styles.noMarginBottom}>
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
            <tr ref={preEntryElement}></tr>
            <tr ref={entryElement} className={styles.entry}>
              <td className={styles.noMarginBottom}>
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
          </tbody>
        </table>
      </div>
      <div>
        <div className={cx(styles.paddingTop, loading ? styles.hidden : '')}>
          Showing {context.before.length} lines {logsSortOrder === LogsSortOrder.Descending ? 'after' : 'before'} match.
        </div>
      </div>
      {getRowContextQuery && (
        <Modal.ButtonRow>
          <Button
            variant="primary"
            onClick={async () => {
              const query = await getRowContextQuery(row);
              if (query?.datasource?.uid) {
                dispatch(
                  splitOpen({
                    queries: [query],
                    range: getFullTimerange(),
                    datasourceUid: query.datasource.uid,
                  })
                );
                onClose();
              }
            }}
          >
            Open in split view
          </Button>
        </Modal.ButtonRow>
      )}
    </Modal>
  );
};
