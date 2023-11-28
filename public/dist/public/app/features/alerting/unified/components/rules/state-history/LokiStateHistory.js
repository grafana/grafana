import { __rest } from "tslib";
import { css } from '@emotion/css';
import { isEmpty, sortBy, take, uniq } from 'lodash';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { dateTime } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Alert, Button, Field, Icon, Input, Label, TagList, Tooltip, useStyles2 } from '@grafana/ui';
import { stateHistoryApi } from '../../../api/stateHistoryApi';
import { combineMatcherStrings } from '../../../utils/alertmanager';
import { HoverCard } from '../../HoverCard';
import { LogRecordViewerByTimestamp } from './LogRecordViewer';
import { LogTimelineViewer } from './LogTimelineViewer';
import { useRuleHistoryRecords } from './useRuleHistoryRecords';
const MAX_TIMELINE_SERIES = 12;
const LokiStateHistory = ({ ruleUID }) => {
    const styles = useStyles2(getStyles);
    const [instancesFilter, setInstancesFilter] = useState('');
    const logsRef = useRef(new Map());
    const { getValues, setValue, register, handleSubmit } = useForm({ defaultValues: { query: '' } });
    const { useGetRuleHistoryQuery } = stateHistoryApi;
    // We prefer log count-based limit rather than time-based, but the API doesn't support it yet
    const queryTimeRange = useMemo(() => getDefaultTimeRange(), []);
    const { currentData: stateHistory, isLoading, isError, error, } = useGetRuleHistoryQuery({
        ruleUid: ruleUID,
        from: queryTimeRange.from.unix(),
        to: queryTimeRange.to.unix(),
        limit: 250,
    });
    const { dataFrames, historyRecords, commonLabels, totalRecordsCount } = useRuleHistoryRecords(stateHistory, instancesFilter);
    const { frameSubset, frameSubsetTimestamps, frameTimeRange } = useFrameSubset(dataFrames);
    const onLogRecordLabelClick = useCallback((label) => {
        const matcherString = combineMatcherStrings(getValues('query'), label);
        setInstancesFilter(matcherString);
        setValue('query', matcherString);
    }, [setInstancesFilter, setValue, getValues]);
    const onFilterCleared = useCallback(() => {
        setInstancesFilter('');
        setValue('query', '');
    }, [setInstancesFilter, setValue]);
    const refToHighlight = useRef(undefined);
    const onTimelinePointerMove = useCallback((seriesIdx, pointIdx) => {
        var _a;
        // remove the highlight from the previous refToHighlight
        (_a = refToHighlight.current) === null || _a === void 0 ? void 0 : _a.classList.remove(styles.highlightedLogRecord);
        const timestamp = frameSubsetTimestamps[pointIdx];
        const newTimestampRef = logsRef.current.get(timestamp);
        // now we have the new ref, add the styles
        newTimestampRef === null || newTimestampRef === void 0 ? void 0 : newTimestampRef.classList.add(styles.highlightedLogRecord);
        // keeping this here (commented) in case we decide we want to go back to this
        // newTimestampRef?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        refToHighlight.current = newTimestampRef;
    }, [frameSubsetTimestamps, styles.highlightedLogRecord]);
    if (isLoading) {
        return React.createElement("div", null, "Loading...");
    }
    if (isError) {
        return (React.createElement(Alert, { title: "Error fetching the state history", severity: "error" }, error instanceof Error ? error.message : 'Unable to fetch alert state history'));
    }
    const hasMoreInstances = frameSubset.length < dataFrames.length;
    const emptyStateMessage = totalRecordsCount > 0
        ? `No matches were found for the given filters among the ${totalRecordsCount} instances`
        : 'No state transitions have occurred in the last 30 days';
    return (React.createElement("div", { className: styles.fullSize },
        React.createElement("form", { onSubmit: handleSubmit((data) => setInstancesFilter(data.query)) },
            React.createElement(SearchFieldInput, Object.assign({}, register('query'), { showClearFilterSuffix: !!instancesFilter, onClearFilterClick: onFilterCleared })),
            React.createElement("input", { type: "submit", hidden: true })),
        !isEmpty(commonLabels) && (React.createElement("div", { className: styles.commonLabels },
            React.createElement(Stack, { gap: 1, alignItems: "center" },
                React.createElement("strong", null, "Common labels"),
                React.createElement(Tooltip, { content: "Common labels are the ones attached to all of the alert instances" },
                    React.createElement(Icon, { name: "info-circle" }))),
            React.createElement(TagList, { tags: commonLabels.map((label) => label.join('=')) }))),
        isEmpty(frameSubset) ? (React.createElement(React.Fragment, null,
            React.createElement("div", { className: styles.emptyState },
                emptyStateMessage,
                totalRecordsCount > 0 && (React.createElement(Button, { variant: "secondary", type: "button", onClick: onFilterCleared }, "Clear filters"))))) : (React.createElement(React.Fragment, null,
            React.createElement("div", { className: styles.graphWrapper },
                React.createElement(LogTimelineViewer, { frames: frameSubset, timeRange: frameTimeRange, onPointerMove: onTimelinePointerMove })),
            hasMoreInstances && (React.createElement("div", { className: styles.moreInstancesWarning },
                React.createElement(Stack, { direction: "row", alignItems: "center", gap: 1 },
                    React.createElement(Icon, { name: "exclamation-triangle", size: "sm" }),
                    React.createElement("small", null, `Only showing ${frameSubset.length} out of ${dataFrames.length} instances. Click on the labels to narrow down the results`)))),
            React.createElement(LogRecordViewerByTimestamp, { records: historyRecords, commonLabels: commonLabels, onRecordsRendered: (recordRefs) => (logsRef.current = recordRefs), onLabelClick: onLogRecordLabelClick })))));
};
function useFrameSubset(frames) {
    return useMemo(() => {
        const frameSubset = take(frames, MAX_TIMELINE_SERIES);
        const frameSubsetTimestamps = sortBy(uniq(frameSubset.flatMap((frame) => frame.fields[0].values)));
        const minTs = Math.min(...frameSubsetTimestamps);
        const maxTs = Math.max(...frameSubsetTimestamps);
        const rangeStart = dateTime(minTs);
        const rangeStop = dateTime(maxTs);
        const frameTimeRange = {
            from: rangeStart,
            to: rangeStop,
            raw: {
                from: rangeStart,
                to: rangeStop,
            },
        };
        return { frameSubset, frameSubsetTimestamps, frameTimeRange };
    }, [frames]);
}
const SearchFieldInput = React.forwardRef((_a, ref) => {
    var { showClearFilterSuffix, onClearFilterClick } = _a, rest = __rest(_a, ["showClearFilterSuffix", "onClearFilterClick"]);
    return (React.createElement(Field, { label: React.createElement(Label, { htmlFor: "instancesSearchInput" },
            React.createElement(Stack, { gap: 0.5 },
                React.createElement("span", null, "Filter instances"),
                React.createElement(HoverCard, { content: React.createElement(React.Fragment, null,
                        "Use label matcher expression (like ",
                        React.createElement("code", null, '{foo=bar}'),
                        ") or click on an instance label to filter instances") },
                    React.createElement(Icon, { name: "info-circle", size: "sm" })))) },
        React.createElement(Input, Object.assign({ id: "instancesSearchInput", prefix: React.createElement(Icon, { name: "search" }), suffix: showClearFilterSuffix && (React.createElement(Button, { fill: "text", icon: "times", size: "sm", onClick: onClearFilterClick }, "Clear")), placeholder: "Filter instances", ref: ref }, rest))));
});
SearchFieldInput.displayName = 'SearchFieldInput';
function getDefaultTimeRange() {
    const fromDateTime = dateTime().subtract(30, 'days');
    const toDateTime = dateTime();
    return {
        from: fromDateTime,
        to: toDateTime,
        raw: { from: fromDateTime, to: toDateTime },
    };
}
export const getStyles = (theme) => ({
    fullSize: css `
    min-width: 100%;
    height: 100%;

    display: flex;
    flex-direction: column;
  `,
    graphWrapper: css `
    padding: ${theme.spacing()} 0;
  `,
    emptyState: css `
    color: ${theme.colors.text.secondary};

    display: flex;
    flex-direction: column;
    gap: ${theme.spacing(2)};
    align-items: center;
    margin: auto auto;
  `,
    moreInstancesWarning: css `
    color: ${theme.colors.warning.text};
    padding: ${theme.spacing()};
  `,
    commonLabels: css `
    display: grid;
    grid-template-columns: max-content auto;
  `,
    // we need !important here to override the list item default styles
    highlightedLogRecord: css `
    background: ${theme.colors.primary.transparent} !important;
    outline: 1px solid ${theme.colors.primary.shade} !important;
  `,
});
export default LokiStateHistory;
//# sourceMappingURL=LokiStateHistory.js.map