import { __read } from "tslib";
import { useCallback, useState } from 'react';
import { DetailState } from '@jaegertracing/jaeger-ui-components';
/**
 * Keeps state of the span detail. This means whether span details are open but also state of each detail subitem
 * like logs or tags.
 */
export function useDetailState() {
    var _a = __read(useState(new Map()), 2), detailStates = _a[0], setDetailStates = _a[1];
    var toggleDetail = useCallback(function toggleDetail(spanID) {
        var newDetailStates = new Map(detailStates);
        if (newDetailStates.has(spanID)) {
            newDetailStates.delete(spanID);
        }
        else {
            newDetailStates.set(spanID, new DetailState());
        }
        setDetailStates(newDetailStates);
    }, [detailStates]);
    var detailLogItemToggle = useCallback(function detailLogItemToggle(spanID, log) {
        var old = detailStates.get(spanID);
        if (!old) {
            return;
        }
        var detailState = old.toggleLogItem(log);
        var newDetailStates = new Map(detailStates);
        newDetailStates.set(spanID, detailState);
        return setDetailStates(newDetailStates);
    }, [detailStates]);
    return {
        detailStates: detailStates,
        toggleDetail: toggleDetail,
        detailLogItemToggle: detailLogItemToggle,
        detailLogsToggle: useCallback(function (spanID) { return makeDetailSubsectionToggle('logs', detailStates, setDetailStates)(spanID); }, [detailStates]),
        detailWarningsToggle: useCallback(function (spanID) { return makeDetailSubsectionToggle('warnings', detailStates, setDetailStates)(spanID); }, [detailStates]),
        detailStackTracesToggle: useCallback(function (spanID) { return makeDetailSubsectionToggle('stackTraces', detailStates, setDetailStates)(spanID); }, [detailStates]),
        detailReferencesToggle: useCallback(function (spanID) { return makeDetailSubsectionToggle('references', detailStates, setDetailStates)(spanID); }, [detailStates]),
        detailProcessToggle: useCallback(function (spanID) { return makeDetailSubsectionToggle('process', detailStates, setDetailStates)(spanID); }, [detailStates]),
        detailTagsToggle: useCallback(function (spanID) { return makeDetailSubsectionToggle('tags', detailStates, setDetailStates)(spanID); }, [detailStates]),
    };
}
function makeDetailSubsectionToggle(subSection, detailStates, setDetailStates) {
    return function (spanID) {
        var old = detailStates.get(spanID);
        if (!old) {
            return;
        }
        var detailState;
        if (subSection === 'tags') {
            detailState = old.toggleTags();
        }
        else if (subSection === 'process') {
            detailState = old.toggleProcess();
        }
        else if (subSection === 'warnings') {
            detailState = old.toggleWarnings();
        }
        else if (subSection === 'references') {
            detailState = old.toggleReferences();
        }
        else if (subSection === 'stackTraces') {
            detailState = old.toggleStackTraces();
        }
        else {
            detailState = old.toggleLogs();
        }
        var newDetailStates = new Map(detailStates);
        newDetailStates.set(spanID, detailState);
        setDetailStates(newDetailStates);
    };
}
//# sourceMappingURL=useDetailState.js.map