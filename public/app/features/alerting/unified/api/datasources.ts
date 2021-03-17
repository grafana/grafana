import { config } from '@grafana/runtime';

export function getAllDataSources() {
  return Object.values(config.datasources);
}

export function getPromAndLokiDataSources() {
  return getAllDataSources().filter(({ type }) => type === 'prometheus' || type === 'loki');
}
