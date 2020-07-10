import { e2e } from '../index';

export const revertAllChanges = () => {
  e2e.getScenarioContext().then(({ addedDashboards, addedDataSources }: any) => {
    addedDashboards.forEach((dashboard: any) => e2e.flows.deleteDashboard({ ...dashboard, quick: true }));
    addedDataSources.forEach((dataSource: any) => e2e.flows.deleteDataSource({ ...dataSource, quick: true }));
  });
};
