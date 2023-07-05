import { css, cx } from '@emotion/css';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAsync } from 'react-use';

import {
  DataQueryResponse,
  DataSourceWithLogsContextSupport,
  GrafanaTheme2,
  LogRowContextOptions,
  LogRowContextQueryDirection,
  LogRowModel,
  LogsDedupStrategy,
  LogsSortOrder,
  dateTime,
  TimeRange,
} from '@grafana/data';
import { config, reportInteraction } from '@grafana/runtime';
import { DataQuery, LoadingState, TimeZone } from '@grafana/schema';
import { Icon, Button, Modal, useTheme2 } from '@grafana/ui';
import store from 'app/core/store';
import { SETTINGS_KEYS } from 'app/features/explore/Logs/utils/logs';
import { splitOpen } from 'app/features/explore/state/main';
import { useDispatch } from 'app/types';

import { dataFrameToLogsModel } from '../../logsModel';
import { sortLogRows } from '../../utils';
import { LogRows } from '../LogRows';

import { LoadingIndicator } from './LoadingIndicator';
import { LogContextButtons } from './LogContextButtons';
import { Place } from './types';

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
    sticky: css`
      position: sticky;
      z-index: 1;
      top: -1px;
      bottom: -1px;
    `,
    entry: css`
      & > td {
        padding: ${theme.spacing(1)} 0 ${theme.spacing(1)} 0;
      }
      background: ${theme.colors.emphasize(theme.colors.background.secondary)};

      & > table {
        margin-bottom: 0;
      }

      & .log-row-menu {
        margin-top: -6px;
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
      border: 1px solid ${theme.colors.border.weak};
      border-radius: ${theme.shape.radius.default};
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
    link: css`
      color: ${theme.colors.text.secondary};
      font-size: ${theme.typography.bodySmall.fontSize};
      :hover {
        color: ${theme.colors.text.link};
      }
    `,
    loadingCell: css`
      position: sticky;
      left: 50%;
      display: inline-block;
      transform: translateX(-50%);
    `,
  };
};

interface LogRowContextModalProps {
  row: LogRowModel;
  open: boolean;
  timeZone: TimeZone;
  onClose: () => void;
  getRowContext: (row: LogRowModel, options: LogRowContextOptions) => Promise<DataQueryResponse>;

  getRowContextQuery?: (row: LogRowModel, options?: LogRowContextOptions) => Promise<DataQuery | null>;
  logsSortOrder: LogsSortOrder;
  runContextQuery?: () => void;
  getLogRowContextUi?: DataSourceWithLogsContextSupport['getLogRowContextUi'];
}

type Section = {
  loadingState: LoadingState;
  rows: LogRowModel[];
};
type Context = Record<Place, Section>;

const makeEmptyContext = (): Context => ({
  above: { loadingState: LoadingState.NotStarted, rows: [] },
  below: { loadingState: LoadingState.NotStarted, rows: [] },
});

const getLoadMoreDirection = (place: Place, sortOrder: LogsSortOrder): LogRowContextQueryDirection => {
  if (place === 'above' && sortOrder === LogsSortOrder.Descending) {
    return LogRowContextQueryDirection.Forward;
  }
  if (place === 'below' && sortOrder === LogsSortOrder.Ascending) {
    return LogRowContextQueryDirection.Forward;
  }

  return LogRowContextQueryDirection.Backward;
};

const PAGE_SIZE = 50;

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
  const scrollElement = useRef<HTMLDivElement | null>(null);
  const entryElement = useRef<HTMLTableRowElement | null>(null);
  // We can not use `entryElement` to scroll to the right element because it's
  // sticky. That's why we add another row and use this ref to scroll to that
  // first.
  const preEntryElement = useRef<HTMLTableRowElement | null>(null);

  const prevScrollHeightRef = useRef<number | null>(null);
  const prevClientHeightRef = useRef<number | null>(null);

  const aboveLoadingElement = useRef<HTMLDivElement | null>(null);
  const belowLoadingElement = useRef<HTMLDivElement | null>(null);

  const dispatch = useDispatch();
  const theme = useTheme2();
  const styles = getStyles(theme);

  const [sticky, setSticky] = useState(true);

  // we need to keep both the "above" and "below" rows
  // in the same react-state, to be able to atomically change both
  // at the same time.
  // we create the `setSection` convenience function to adjust any
  // part of it easily.
  const [context, setContext] = useState<Context>(makeEmptyContext());
  const setSection = (place: Place, fun: (s: Section) => Section) => {
    setContext((c) => {
      const newContext = { ...c };
      newContext[place] = fun(c[place]);
      return newContext;
    });
  };

  // this is used to "cancel" the ongoing load-more requests.
  // whenever we want to cancel them, we increment this number.
  // and when those requests return, we check if the number
  // is still the same as when we started. and if it is not the same,
  // we ignore the results.
  //
  // best would be to literally cancel those requests,
  // but right now there's no way with the current logs-context API.
  const generationRef = useRef(1);

  const [contextQuery, setContextQuery] = useState<DataQuery | null>(null);
  const [wrapLines, setWrapLines] = useState(
    store.getBool(SETTINGS_KEYS.logContextWrapLogMessage, store.getBool(SETTINGS_KEYS.wrapLogMessage, true))
  );
  const getFullTimeRange = useCallback(() => {
    const { below, above } = context;
    const allRows = sortLogRows([...below.rows, row, ...above.rows], LogsSortOrder.Ascending);
    const fromMs = allRows[0].timeEpochMs;
    let toMs = allRows[allRows.length - 1].timeEpochMs;
    // In case we have a lot of logs and from and to have same millisecond
    // we add 1 millisecond to toMs to make sure we have a range
    if (fromMs === toMs) {
      toMs += 1;
    }
    const from = dateTime(fromMs);
    const to = dateTime(toMs);

    const range: TimeRange = {
      from,
      to,
      raw: {
        from,
        to,
      },
    };
    return range;
  }, [context, row]);

  const updateContextQuery = useCallback(async () => {
    const contextQuery = getRowContextQuery ? await getRowContextQuery(row) : null;
    setContextQuery(contextQuery);
  }, [row, getRowContextQuery]);

  const updateResults = async () => {
    await updateContextQuery();
    setContext(makeEmptyContext());
    generationRef.current += 1; // results from currently running loadMore calls will be ignored
  };

  const loadMore = async (place: Place): Promise<LogRowModel[]> => {
    const { below, above } = context;
    // we consider all the currently existing rows, even the original row,
    // this way this array of rows will never be empty
    const allRows = [...above.rows, row, ...below.rows];
    const refRow = allRows.at(place === 'above' ? 0 : -1);
    if (refRow == null) {
      throw new Error('should never happen. the array always contains at least 1 item (the middle row)');
    }

    const direction = getLoadMoreDirection(place, logsSortOrder);

    const result = await getRowContext(refRow, { limit: PAGE_SIZE, direction });
    const newRows = dataFrameToLogsModel(result.data).rows;

    if (logsSortOrder === LogsSortOrder.Ascending) {
      newRows.reverse();
    }

    const out = newRows.filter((r) => {
      return r.timeEpochNs !== refRow.timeEpochNs || r.entry !== refRow.entry;
    });

    return out;
  };

  useEffect(() => {
    if (open) {
      updateContextQuery();
    }
  }, [updateContextQuery, open]);

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

  const maybeLoadMore = async (place: Place) => {
    const section = context[place];
    if (section.loadingState === LoadingState.Loading) {
      return;
    }

    setSection(place, (section) => ({
      ...section,
      loadingState: LoadingState.Loading,
    }));

    const currentGen = generationRef.current;
    try {
      const newRows = await loadMore(place);
      if (currentGen === generationRef.current) {
        setSection(place, (section) => ({
          rows: place === 'above' ? [...newRows, ...section.rows] : [...section.rows, ...newRows],
          loadingState: newRows.length === 0 ? LoadingState.Done : LoadingState.NotStarted,
        }));
      }
    } catch {
      setSection(place, (section) => ({
        rows: section.rows,
        loadingState: LoadingState.Error,
      }));
    }
  };

  const onScrollHit = async (entries: IntersectionObserverEntry[], observer: IntersectionObserver) => {
    for (const entry of entries) {
      // If the element is not intersecting, skip to the next one
      if (!entry.isIntersecting) {
        continue;
      }

      const targetElement = entry.target;

      if (targetElement === aboveLoadingElement.current) {
        maybeLoadMore('above');
      } else if (targetElement === belowLoadingElement.current) {
        maybeLoadMore('below');
      }
    }
  };

  useEffect(() => {
    const scroll = scrollElement.current;
    const aboveElem = aboveLoadingElement.current;
    const belowElem = belowLoadingElement.current;

    if (scroll == null) {
      // should not happen, but need to make typescript happy
      return;
    }

    const observer = new IntersectionObserver(onScrollHit, { root: scroll });

    if (aboveElem != null) {
      observer.observe(aboveElem);
    }

    if (belowElem != null) {
      observer.observe(belowElem);
    }

    return () => {
      observer.disconnect();
    };
  }); // on every render, why not

  const scrollToCenter = useCallback(() => {
    preEntryElement.current?.scrollIntoView({ block: 'center' });
    entryElement.current?.scrollIntoView({ block: 'center' });
  }, [preEntryElement, entryElement]);

  useLayoutEffect(() => {
    const scrollE = scrollElement.current;
    if (scrollE == null) {
      return;
    }

    const prevClientHeight = prevClientHeightRef.current;
    const currentClientHeight = scrollE.clientHeight;
    prevClientHeightRef.current = currentClientHeight;
    if (prevClientHeight !== currentClientHeight) {
      // height has changed, we scroll to the center
      scrollToCenter();
      return;
    }

    const prevScrollHeight = prevScrollHeightRef.current;
    const currentHeight = scrollE.scrollHeight;
    prevScrollHeightRef.current = currentHeight;
    if (prevScrollHeight != null) {
      const newScrollTop = scrollE.scrollTop + (currentHeight - prevScrollHeight);
      scrollE.scrollTop = newScrollTop;
    }
  }, [context.above.rows, scrollToCenter]);

  useAsync(updateContextQuery, [getRowContextQuery, row]);

  const loadingStateAbove = context.above.loadingState;
  const loadingStateBelow = context.below.loadingState;

  return (
    <Modal
      isOpen={open}
      title="Log context"
      contentClassName={styles.flexColumn}
      className={styles.modal}
      onDismiss={onClose}
    >
      {config.featureToggles.logsContextDatasourceUi && getLogRowContextUi && (
        <div className={styles.datasourceUi}>{getLogRowContextUi(row, updateResults)}</div>
      )}
      <div className={cx(styles.flexRow, styles.paddingBottom)}>
        <div>
          <LogContextButtons
            wrapLines={wrapLines}
            onChangeWrapLines={setWrapLines}
            onScrollCenterClick={scrollToCenter}
          />
        </div>
      </div>
      <div ref={scrollElement} className={styles.logRowGroups}>
        <table>
          <tbody>
            <tr>
              <td className={styles.loadingCell}>
                {loadingStateAbove !== LoadingState.Done && loadingStateAbove !== LoadingState.Error && (
                  <div ref={aboveLoadingElement}>
                    <LoadingIndicator place="above" />
                  </div>
                )}
                {loadingStateAbove === LoadingState.Error && <div>Error loading log more logs.</div>}
                {loadingStateAbove === LoadingState.Done && <div>No more logs available.</div>}
              </td>
            </tr>
            <tr>
              <td className={styles.noMarginBottom}>
                <LogRows
                  logRows={context.above.rows}
                  dedupStrategy={LogsDedupStrategy.none}
                  showLabels={store.getBool(SETTINGS_KEYS.showLabels, false)}
                  showTime={store.getBool(SETTINGS_KEYS.showTime, true)}
                  wrapLogMessage={wrapLines}
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
            <tr ref={entryElement} className={cx(styles.entry, sticky ? styles.sticky : null)} data-testid="entry-row">
              <td className={styles.noMarginBottom}>
                <LogRows
                  logRows={[row]}
                  dedupStrategy={LogsDedupStrategy.none}
                  showLabels={store.getBool(SETTINGS_KEYS.showLabels, false)}
                  showTime={store.getBool(SETTINGS_KEYS.showTime, true)}
                  wrapLogMessage={wrapLines}
                  prettifyLogMessage={store.getBool(SETTINGS_KEYS.prettifyLogMessage, false)}
                  enableLogDetails={true}
                  timeZone={timeZone}
                  displayedFields={displayedFields}
                  onClickShowField={showField}
                  onClickHideField={hideField}
                  onUnpinLine={() => setSticky(false)}
                  onPinLine={() => setSticky(true)}
                  pinnedRowId={sticky ? row.uid : undefined}
                />
              </td>
            </tr>
            <tr>
              <td>
                <>
                  <LogRows
                    logRows={context.below.rows}
                    dedupStrategy={LogsDedupStrategy.none}
                    showLabels={store.getBool(SETTINGS_KEYS.showLabels, false)}
                    showTime={store.getBool(SETTINGS_KEYS.showTime, true)}
                    wrapLogMessage={wrapLines}
                    prettifyLogMessage={store.getBool(SETTINGS_KEYS.prettifyLogMessage, false)}
                    enableLogDetails={true}
                    timeZone={timeZone}
                    displayedFields={displayedFields}
                    onClickShowField={showField}
                    onClickHideField={hideField}
                  />
                </>
              </td>
            </tr>
            <tr>
              <td className={styles.loadingCell}>
                {loadingStateBelow !== LoadingState.Done && loadingStateBelow !== LoadingState.Error && (
                  <div ref={belowLoadingElement}>
                    <LoadingIndicator place="below" />
                  </div>
                )}
                {loadingStateBelow === LoadingState.Error && <div>Error loading log more logs.</div>}
                {loadingStateBelow === LoadingState.Done && <div>No more logs available.</div>}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <Modal.ButtonRow>
        <a
          href="https://forms.gle/Tsk4pN7vD95aBRbb7"
          className={styles.link}
          title="We recently reworked the Log Context UI, please let us know how we can further improve it."
          target="_blank"
          rel="noreferrer noopener"
          onClick={() => {
            reportInteraction('grafana_explore_logs_log_context_give_feedback_clicked', {
              datasourceType: row.datasourceType,
              logRowUid: row.uid,
            });
          }}
        >
          <Icon name="comment-alt-message" /> Give feedback
        </a>
        {contextQuery?.datasource?.uid && (
          <Button
            variant="secondary"
            onClick={async () => {
              let rowId = row.uid;
              if (row.dataFrame.refId) {
                // the orignal row has the refid from the base query and not the refid from the context query, so we need to replace it.
                rowId = row.uid.replace(row.dataFrame.refId, contextQuery.refId);
              }

              dispatch(
                splitOpen({
                  queries: [contextQuery],
                  range: getFullTimeRange(),
                  datasourceUid: contextQuery.datasource!.uid!,
                  panelsState: {
                    logs: {
                      id: rowId,
                    },
                  },
                })
              );
              onClose();
              reportInteraction('grafana_explore_logs_log_context_open_split_view_clicked', {
                datasourceType: row.datasourceType,
                logRowUid: row.uid,
              });
            }}
          >
            Open in split view
          </Button>
        )}
      </Modal.ButtonRow>
    </Modal>
  );
};
