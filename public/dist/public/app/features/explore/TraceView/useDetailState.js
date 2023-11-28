import { useCallback, useState, useEffect } from 'react';
import { DetailState } from './components';
/**
 * Keeps state of the span detail. This means whether span details are open but also state of each detail subitem
 * like logs or tags.
 */
export function useDetailState(frame) {
    const [detailStates, setDetailStates] = useState(new Map());
    // Clear detail state when new trace arrives
    useEffect(() => {
        setDetailStates(new Map());
    }, [frame, setDetailStates]);
    const toggleDetail = useCallback(function toggleDetail(spanID) {
        const newDetailStates = new Map(detailStates);
        if (newDetailStates.has(spanID)) {
            newDetailStates.delete(spanID);
        }
        else {
            newDetailStates.set(spanID, new DetailState());
        }
        setDetailStates(newDetailStates);
    }, [detailStates]);
    const detailLogItemToggle = useCallback(function detailLogItemToggle(spanID, log) {
        const old = detailStates.get(spanID);
        if (!old) {
            return;
        }
        const detailState = old.toggleLogItem(log);
        const newDetailStates = new Map(detailStates);
        newDetailStates.set(spanID, detailState);
        return setDetailStates(newDetailStates);
    }, [detailStates]);
    const detailReferenceItemToggle = useCallback(function detailReferenceItemToggle(spanID, reference) {
        const old = detailStates.get(spanID);
        if (!old) {
            return;
        }
        const detailState = old.toggleReferenceItem(reference);
        const newDetailStates = new Map(detailStates);
        newDetailStates.set(spanID, detailState);
        return setDetailStates(newDetailStates);
    }, [detailStates]);
    return {
        detailStates,
        toggleDetail,
        detailLogItemToggle,
        detailLogsToggle: useCallback((spanID) => makeDetailSubsectionToggle('logs', detailStates, setDetailStates)(spanID), [detailStates]),
        detailWarningsToggle: useCallback((spanID) => makeDetailSubsectionToggle('warnings', detailStates, setDetailStates)(spanID), [detailStates]),
        detailStackTracesToggle: useCallback((spanID) => makeDetailSubsectionToggle('stackTraces', detailStates, setDetailStates)(spanID), [detailStates]),
        detailReferenceItemToggle,
        detailReferencesToggle: useCallback((spanID) => makeDetailSubsectionToggle('references', detailStates, setDetailStates)(spanID), [detailStates]),
        detailProcessToggle: useCallback((spanID) => makeDetailSubsectionToggle('process', detailStates, setDetailStates)(spanID), [detailStates]),
        detailTagsToggle: useCallback((spanID) => makeDetailSubsectionToggle('tags', detailStates, setDetailStates)(spanID), [detailStates]),
    };
}
function makeDetailSubsectionToggle(subSection, detailStates, setDetailStates) {
    return (spanID) => {
        const old = detailStates.get(spanID);
        if (!old) {
            return;
        }
        let detailState;
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
        const newDetailStates = new Map(detailStates);
        newDetailStates.set(spanID, detailState);
        setDetailStates(newDetailStates);
    };
}
//# sourceMappingURL=useDetailState.js.map