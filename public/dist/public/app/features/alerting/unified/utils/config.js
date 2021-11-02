import { config } from '@grafana/runtime';
export function getAllDataSources() {
    return Object.values(config.datasources);
}
//# sourceMappingURL=config.js.map