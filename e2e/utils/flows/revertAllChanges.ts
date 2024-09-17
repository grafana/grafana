import { e2e } from '../index';

export const revertAllChanges = () => {
  e2e.getScenarioContext().then(({ addedDashboards, addedDataSources, hasChangedUserPreferences }) => {
    addedDashboards.forEach((dashboard) => e2e.flows.deleteDashboard({ ...dashboard, quick: true }));
    addedDataSources.forEach((dataSource) => e2e.flows.deleteDataSource({ ...dataSource, quick: true }));

    if (hasChangedUserPreferences) {
      e2e.flows.setDefaultUserPreferences();
    }
  });
};
