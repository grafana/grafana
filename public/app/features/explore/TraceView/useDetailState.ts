import { useCallback, useState } from 'react';
import { DetailState } from '@jaegertracing/jaeger-ui-components';
import { TraceLog } from '@grafana/data';

/**
 * Keeps state of the span detail. This means whether span details are open but also state of each detail subitem
 * like logs or tags.
 */
export function useDetailState() {
  const [detailStates, setDetailStates] = useState(new Map<string, DetailState>());

  const toggleDetail = useCallback(
    function toggleDetail(spanID: string) {
      const newDetailStates = new Map(detailStates);
      if (newDetailStates.has(spanID)) {
        newDetailStates.delete(spanID);
      } else {
        newDetailStates.set(spanID, new DetailState());
      }
      setDetailStates(newDetailStates);
    },
    [detailStates]
  );

  const detailLogItemToggle = useCallback(
    function detailLogItemToggle(spanID: string, log: TraceLog) {
      const old = detailStates.get(spanID);
      if (!old) {
        return;
      }
      const detailState = old.toggleLogItem(log);
      const newDetailStates = new Map(detailStates);
      newDetailStates.set(spanID, detailState);
      return setDetailStates(newDetailStates);
    },
    [detailStates]
  );

  return {
    detailStates,
    toggleDetail,
    detailLogItemToggle,
    detailLogsToggle: useCallback(makeDetailSubsectionToggle('logs', detailStates, setDetailStates), [detailStates]),
    detailWarningsToggle: useCallback(makeDetailSubsectionToggle('warnings', detailStates, setDetailStates), [
      detailStates,
    ]),
    detailStackTracesToggle: useCallback(makeDetailSubsectionToggle('stackTraces', detailStates, setDetailStates), [
      detailStates,
    ]),
    detailReferencesToggle: useCallback(makeDetailSubsectionToggle('references', detailStates, setDetailStates), [
      detailStates,
    ]),
    detailProcessToggle: useCallback(makeDetailSubsectionToggle('process', detailStates, setDetailStates), [
      detailStates,
    ]),
    detailTagsToggle: useCallback(makeDetailSubsectionToggle('tags', detailStates, setDetailStates), [detailStates]),
  };
}

function makeDetailSubsectionToggle(
  subSection: 'tags' | 'process' | 'logs' | 'warnings' | 'references' | 'stackTraces',
  detailStates: Map<string, DetailState>,
  setDetailStates: (detailStates: Map<string, DetailState>) => void
) {
  return (spanID: string) => {
    const old = detailStates.get(spanID);
    if (!old) {
      return;
    }
    let detailState;
    if (subSection === 'tags') {
      detailState = old.toggleTags();
    } else if (subSection === 'process') {
      detailState = old.toggleProcess();
    } else if (subSection === 'warnings') {
      detailState = old.toggleWarnings();
    } else if (subSection === 'references') {
      detailState = old.toggleReferences();
    } else if (subSection === 'stackTraces') {
      detailState = old.toggleStackTraces();
    } else {
      detailState = old.toggleLogs();
    }
    const newDetailStates = new Map(detailStates);
    newDetailStates.set(spanID, detailState);
    setDetailStates(newDetailStates);
  };
}
