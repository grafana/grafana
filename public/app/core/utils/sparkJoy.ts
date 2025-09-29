import { store } from '@grafana/data';

export const SPARK_JOY_LOCAL_STORAGE_KEY = 'grafana.sparkJoy.enabled';

export function getSparkJoyEnabled(defaultValue = true): boolean {
  return store.getBool(SPARK_JOY_LOCAL_STORAGE_KEY, defaultValue);
}

export function setSparkJoyEnabled(enabled: boolean): void {
  store.set(SPARK_JOY_LOCAL_STORAGE_KEY, enabled);
}
