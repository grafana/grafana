import { sharedSingleStatMigrationHandler } from '@grafana/ui';
export var barGaugePanelMigrationHandler = function (panel) {
    return sharedSingleStatMigrationHandler(panel);
};
//# sourceMappingURL=BarGaugeMigrations.js.map