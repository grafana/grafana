import { useCallback, useState } from 'react';

import store from '../../../../../../core/store';

export const promQueryEditorExplainKey = 'PrometheusQueryEditorExplainDefault';
export const promQueryEditorRawQueryKey = 'PrometheusQueryEditorRawQueryDefault';
export const lokiQueryEditorExplainKey = 'LokiQueryEditorExplainDefault';
export const lokiQueryEditorRawQueryKey = 'LokiQueryEditorRawQueryDefault';

export type QueryEditorFlags =
  | typeof promQueryEditorExplainKey
  | typeof promQueryEditorRawQueryKey
  | typeof lokiQueryEditorExplainKey
  | typeof lokiQueryEditorRawQueryKey;

function getFlagValue(key: QueryEditorFlags, defaultValue = false): boolean {
  const val = store.get(key);
  return val === undefined ? defaultValue : Boolean(parseInt(val, 10));
}

function setFlagValue(key: QueryEditorFlags, value: boolean) {
  store.set(key, value ? '1' : '0');
}

type UseFlagHookReturnType = { flag: boolean; setFlag: (val: boolean) => void };

/**
 *
 * Use and store value of explain/rawquery switch in local storage.
 * Needs to be a hook with local state to trigger re-renders.
 */
export function useFlag(key: QueryEditorFlags, defaultValue = false): UseFlagHookReturnType {
  const [flag, updateFlag] = useState(getFlagValue(key, defaultValue));
  const setter = useCallback(
    (value: boolean) => {
      setFlagValue(key, value);
      updateFlag(value);
    },
    [key]
  );

  return { flag, setFlag: setter };
}
