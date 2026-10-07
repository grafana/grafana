export const ALERTS_FILTER_STORAGE_KEY = 'grafana.home.alerts.filter';

/**
 * The homepage alerts filter selection: '' for the default scope ("your teams" for team members,
 * everything otherwise), ALL_TEAMS for an explicit org-wide pick, otherwise `key:value` naming one
 * alert rule label (e.g. `team:platform`, `severity:critical`).
 * A plain string so localStorage and the Combobox can hold it as-is.
 */
export type AlertFilterSelection = string;
