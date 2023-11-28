import { __awaiter } from "tslib";
import { css, cx } from '@emotion/css';
import { partition } from 'lodash';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAsync } from 'react-use';
import { LogRowContextQueryDirection, LogsDedupStrategy, LogsSortOrder, dateTime, LoadingState, } from '@grafana/data';
import { config, reportInteraction } from '@grafana/runtime';
import { Button, Modal, useTheme2 } from '@grafana/ui';
import store from 'app/core/store';
import { SETTINGS_KEYS } from 'app/features/explore/Logs/utils/logs';
import { splitOpen } from 'app/features/explore/state/main';
import { useDispatch } from 'app/types';
import { dataFrameToLogsModel } from '../../logsModel';
import { sortLogRows } from '../../utils';
import { LogRows } from '../LogRows';
import { LoadingIndicator } from './LoadingIndicator';
import { LogContextButtons } from './LogContextButtons';
const getStyles = (theme) => {
    return {
        modal: css `
      width: 85vw;
      ${theme.breakpoints.down('md')} {
        width: 100%;
      }
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    `,
        sticky: css `
      position: sticky;
      z-index: 1;
      top: -1px;
      bottom: -1px;
    `,
        entry: css `
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
        datasourceUi: css `
      padding-bottom: ${theme.spacing(1.25)};
      display: flex;
      align-items: center;
    `,
        logRowGroups: css `
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
        flexColumn: css `
      display: flex;
      flex-direction: column;
      padding: 0 ${theme.spacing(3)} ${theme.spacing(3)} ${theme.spacing(3)};
    `,
        flexRow: css `
      display: flex;
      flex-direction: row;
      align-items: center;
      & > div:last-child {
        margin-left: auto;
      }
    `,
        noMarginBottom: css `
      & > table {
        margin-bottom: 0;
      }
    `,
        hidden: css `
      display: none;
    `,
        paddingTop: css `
      padding-top: ${theme.spacing(1)};
    `,
        paddingBottom: css `
      padding-bottom: ${theme.spacing(1)};
    `,
        link: css `
      color: ${theme.colors.text.secondary};
      font-size: ${theme.typography.bodySmall.fontSize};
      :hover {
        color: ${theme.colors.text.link};
      }
    `,
        loadingCell: css `
      position: sticky;
      left: 50%;
      display: inline-block;
      transform: translateX(-50%);
    `,
    };
};
const makeEmptyContext = () => ({
    above: { loadingState: LoadingState.NotStarted, rows: [] },
    below: { loadingState: LoadingState.NotStarted, rows: [] },
});
const getLoadMoreDirection = (place, sortOrder) => {
    if (place === 'above' && sortOrder === LogsSortOrder.Descending) {
        return LogRowContextQueryDirection.Forward;
    }
    if (place === 'below' && sortOrder === LogsSortOrder.Ascending) {
        return LogRowContextQueryDirection.Forward;
    }
    return LogRowContextQueryDirection.Backward;
};
const normalizeLogRowRefId = (row, counter) => {
    // the datasoure plugins often create the context-query based on the row's dataframe's refId,
    // by appending something to it. for example:
    // - let's say the row's dataframe's refId is "query"
    // - the datasource plugin will take "query" and append "-context" to it, so it becomes "query-context".
    // - later we want to load even more lines, so we make a context query
    // - the datasource plugin does the same transform again, but now the source is "query-context",
    //   so the new refId becomes "query-context-context"
    // - next time it becomes "query-context-context-context", and so on.
    // we do not want refIds to grow unbounded.
    // to avoid this, we set the refId to a value that does not grow.
    // on the other hand, the refId is also used in generating the row's UID, so it is useful
    // when the refId is not always the exact same string, otherwise UID duplication can occur,
    // which may cause problems.
    // so we go with an approach where the refId always changes, but does not grow.
    return Object.assign(Object.assign({}, row), { dataFrame: Object.assign(Object.assign({}, row.dataFrame), { refId: `context_${counter.above}_${counter.below}` }) });
};
const containsRow = (rows, row) => {
    return rows.some((r) => r.entry === row.entry && r.timeEpochNs === row.timeEpochNs);
};
const PAGE_SIZE = 100;
export const LogRowContextModal = ({ row, open, logsSortOrder, timeZone, getLogRowContextUi, getRowContextQuery, onClose, getRowContext, }) => {
    var _a;
    const scrollElement = useRef(null);
    const entryElement = useRef(null);
    // We can not use `entryElement` to scroll to the right element because it's
    // sticky. That's why we add another row and use this ref to scroll to that
    // first.
    const preEntryElement = useRef(null);
    const prevScrollHeightRef = useRef(null);
    const prevClientHeightRef = useRef(null);
    const aboveLoadingElement = useRef(null);
    const belowLoadingElement = useRef(null);
    const loadCountRef = useRef({ above: 0, below: 0 });
    const dispatch = useDispatch();
    const theme = useTheme2();
    const styles = getStyles(theme);
    const [sticky, setSticky] = useState(true);
    // we need to keep both the "above" and "below" rows
    // in the same react-state, to be able to atomically change both
    // at the same time.
    // we create the `setSection` convenience function to adjust any
    // part of it easily.
    const [context, setContext] = useState(makeEmptyContext());
    const setSection = (place, fun) => {
        setContext((c) => {
            const newContext = Object.assign({}, c);
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
    const [contextQuery, setContextQuery] = useState(null);
    const [wrapLines, setWrapLines] = useState(store.getBool(SETTINGS_KEYS.logContextWrapLogMessage, store.getBool(SETTINGS_KEYS.wrapLogMessage, true)));
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
        const range = {
            from,
            to,
            raw: {
                from,
                to,
            },
        };
        return range;
    }, [context, row]);
    const updateContextQuery = useCallback(() => __awaiter(void 0, void 0, void 0, function* () {
        const contextQuery = getRowContextQuery ? yield getRowContextQuery(row) : null;
        setContextQuery(contextQuery);
    }), [row, getRowContextQuery]);
    const updateResults = () => __awaiter(void 0, void 0, void 0, function* () {
        yield updateContextQuery();
        setContext(makeEmptyContext());
        loadCountRef.current = { above: 0, below: 0 };
        generationRef.current += 1; // results from currently running loadMore calls will be ignored
    });
    const loadMore = (place, allRows) => __awaiter(void 0, void 0, void 0, function* () {
        loadCountRef.current[place] += 1;
        const refRow = allRows.at(place === 'above' ? 0 : -1);
        if (refRow == null) {
            throw new Error('should never happen. the array always contains at least 1 item (the middle row)');
        }
        reportInteraction('grafana_explore_logs_log_context_load_more_called', {
            datasourceType: refRow.datasourceType,
            above: loadCountRef.current.above,
            below: loadCountRef.current.below,
        });
        const direction = getLoadMoreDirection(place, logsSortOrder);
        const result = yield getRowContext(normalizeLogRowRefId(refRow, loadCountRef.current), {
            limit: PAGE_SIZE,
            direction,
        });
        const newRows = dataFrameToLogsModel(result.data).rows;
        if (logsSortOrder === LogsSortOrder.Ascending) {
            newRows.reverse();
        }
        const out = newRows.filter((r) => {
            return !containsRow(allRows, r);
        });
        return out;
    });
    useEffect(() => {
        if (open) {
            updateContextQuery();
        }
    }, [updateContextQuery, open]);
    const [displayedFields, setDisplayedFields] = useState([]);
    const showField = (key) => {
        const index = displayedFields.indexOf(key);
        if (index === -1) {
            setDisplayedFields([...displayedFields, key]);
        }
    };
    const hideField = (key) => {
        const index = displayedFields.indexOf(key);
        if (index > -1) {
            displayedFields.splice(index, 1);
            setDisplayedFields([...displayedFields]);
        }
    };
    const maybeLoadMore = (place) => __awaiter(void 0, void 0, void 0, function* () {
        const { below, above } = context;
        const section = context[place];
        if (section.loadingState === LoadingState.Loading) {
            return;
        }
        setSection(place, (section) => (Object.assign(Object.assign({}, section), { loadingState: LoadingState.Loading })));
        const currentGen = generationRef.current;
        try {
            // we consider all the currently existing rows, even the original row,
            // this way this array of rows will never be empty
            const allRows = [...above.rows, row, ...below.rows];
            const newRows = yield loadMore(place, allRows);
            const [older, newer] = partition(newRows, (newRow) => newRow.timeEpochNs > row.timeEpochNs);
            const newAbove = logsSortOrder === LogsSortOrder.Ascending ? newer : older;
            const newBelow = logsSortOrder === LogsSortOrder.Ascending ? older : newer;
            if (currentGen === generationRef.current) {
                setContext((c) => {
                    // we should only modify the row-arrays if necessary
                    const sortedNewAbove = newAbove.length > 0 ? sortLogRows([...newAbove, ...c.above.rows], logsSortOrder) : c.above.rows;
                    const sortedNewBelow = newBelow.length > 0 ? sortLogRows([...c.below.rows, ...newBelow], logsSortOrder) : c.below.rows;
                    return {
                        above: {
                            rows: sortedNewAbove,
                            loadingState: place === 'above'
                                ? newRows.length === 0
                                    ? LoadingState.Done
                                    : LoadingState.NotStarted
                                : c.above.loadingState,
                        },
                        below: {
                            rows: sortedNewBelow,
                            loadingState: place === 'below'
                                ? newRows.length === 0
                                    ? LoadingState.Done
                                    : LoadingState.NotStarted
                                : c.below.loadingState,
                        },
                    };
                });
            }
        }
        catch (_b) {
            setSection(place, (section) => ({
                rows: section.rows,
                loadingState: LoadingState.Error,
            }));
        }
    });
    const onScrollHit = (entries, observer) => __awaiter(void 0, void 0, void 0, function* () {
        for (const entry of entries) {
            // If the element is not intersecting, skip to the next one
            if (!entry.isIntersecting) {
                continue;
            }
            const targetElement = entry.target;
            if (targetElement === aboveLoadingElement.current) {
                maybeLoadMore('above');
            }
            else if (targetElement === belowLoadingElement.current) {
                maybeLoadMore('below');
            }
        }
    });
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
        var _a, _b;
        (_a = preEntryElement.current) === null || _a === void 0 ? void 0 : _a.scrollIntoView({ block: 'center' });
        (_b = entryElement.current) === null || _b === void 0 ? void 0 : _b.scrollIntoView({ block: 'center' });
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
        // if the newly loaded content is part of the initial load of `above` and `below`,
        // we scroll to center, to keep the chosen log-row centered
        if (loadCountRef.current.above <= 1 && loadCountRef.current.below <= 1) {
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
    return (React.createElement(Modal, { isOpen: open, title: "Log context", contentClassName: styles.flexColumn, className: styles.modal, onDismiss: onClose },
        config.featureToggles.logsContextDatasourceUi && getLogRowContextUi && (React.createElement("div", { className: styles.datasourceUi }, getLogRowContextUi(row, updateResults))),
        React.createElement("div", { className: cx(styles.flexRow, styles.paddingBottom) },
            React.createElement("div", null,
                React.createElement(LogContextButtons, { wrapLines: wrapLines, onChangeWrapLines: setWrapLines, onScrollCenterClick: scrollToCenter }))),
        React.createElement("div", { ref: scrollElement, className: styles.logRowGroups },
            React.createElement("table", null,
                React.createElement("tbody", null,
                    React.createElement("tr", null,
                        React.createElement("td", { className: styles.loadingCell },
                            loadingStateAbove !== LoadingState.Done && loadingStateAbove !== LoadingState.Error && (React.createElement("div", { ref: aboveLoadingElement },
                                React.createElement(LoadingIndicator, { place: "above" }))),
                            loadingStateAbove === LoadingState.Error && React.createElement("div", null, "Error loading log more logs."),
                            loadingStateAbove === LoadingState.Done && React.createElement("div", null, "No more logs available."))),
                    React.createElement("tr", null,
                        React.createElement("td", { className: styles.noMarginBottom },
                            React.createElement(LogRows, { logRows: context.above.rows, dedupStrategy: LogsDedupStrategy.none, showLabels: store.getBool(SETTINGS_KEYS.showLabels, false), showTime: store.getBool(SETTINGS_KEYS.showTime, true), wrapLogMessage: wrapLines, prettifyLogMessage: store.getBool(SETTINGS_KEYS.prettifyLogMessage, false), enableLogDetails: true, timeZone: timeZone, displayedFields: displayedFields, onClickShowField: showField, onClickHideField: hideField }))),
                    React.createElement("tr", { ref: preEntryElement }),
                    React.createElement("tr", { ref: entryElement, className: cx(styles.entry, sticky ? styles.sticky : null), "data-testid": "entry-row" },
                        React.createElement("td", { className: styles.noMarginBottom },
                            React.createElement(LogRows, { logRows: [row], dedupStrategy: LogsDedupStrategy.none, showLabels: store.getBool(SETTINGS_KEYS.showLabels, false), showTime: store.getBool(SETTINGS_KEYS.showTime, true), wrapLogMessage: wrapLines, prettifyLogMessage: store.getBool(SETTINGS_KEYS.prettifyLogMessage, false), enableLogDetails: true, timeZone: timeZone, displayedFields: displayedFields, onClickShowField: showField, onClickHideField: hideField, onUnpinLine: () => setSticky(false), onPinLine: () => setSticky(true), pinnedRowId: sticky ? row.uid : undefined, overflowingContent: true }))),
                    React.createElement("tr", null,
                        React.createElement("td", null,
                            React.createElement(React.Fragment, null,
                                React.createElement(LogRows, { logRows: context.below.rows, dedupStrategy: LogsDedupStrategy.none, showLabels: store.getBool(SETTINGS_KEYS.showLabels, false), showTime: store.getBool(SETTINGS_KEYS.showTime, true), wrapLogMessage: wrapLines, prettifyLogMessage: store.getBool(SETTINGS_KEYS.prettifyLogMessage, false), enableLogDetails: true, timeZone: timeZone, displayedFields: displayedFields, onClickShowField: showField, onClickHideField: hideField })))),
                    React.createElement("tr", null,
                        React.createElement("td", { className: styles.loadingCell },
                            loadingStateBelow !== LoadingState.Done && loadingStateBelow !== LoadingState.Error && (React.createElement("div", { ref: belowLoadingElement },
                                React.createElement(LoadingIndicator, { place: "below" }))),
                            loadingStateBelow === LoadingState.Error && React.createElement("div", null, "Error loading log more logs."),
                            loadingStateBelow === LoadingState.Done && React.createElement("div", null, "No more logs available.")))))),
        React.createElement(Modal.ButtonRow, null, ((_a = contextQuery === null || contextQuery === void 0 ? void 0 : contextQuery.datasource) === null || _a === void 0 ? void 0 : _a.uid) && (React.createElement(Button, { variant: "secondary", onClick: () => __awaiter(void 0, void 0, void 0, function* () {
                let rowId = row.uid;
                if (row.dataFrame.refId) {
                    // the orignal row has the refid from the base query and not the refid from the context query, so we need to replace it.
                    rowId = row.uid.replace(row.dataFrame.refId, contextQuery.refId);
                }
                dispatch(splitOpen({
                    queries: [contextQuery],
                    range: getFullTimeRange(),
                    datasourceUid: contextQuery.datasource.uid,
                    panelsState: {
                        logs: {
                            id: rowId,
                        },
                    },
                }));
                onClose();
                reportInteraction('grafana_explore_logs_log_context_open_split_view_clicked', {
                    datasourceType: row.datasourceType,
                    logRowUid: row.uid,
                });
            }) }, "Open in split view")))));
};
//# sourceMappingURL=LogRowContextModal.js.map