import { configurePanel, PartialConfigurePanelConfig } from './configurePanel';
import { getScenarioContext } from '../support/scenarioContext';

export const explore = (config: Partial<PartialConfigurePanelConfig>) =>
  getScenarioContext().then(({ lastAddedDataSource }: any) =>
    configurePanel({
      dataSourceName: lastAddedDataSource,
      screenshotName: 'explore-graph',
      ...config,
      isEdit: false,
      isExplore: true,
      timeRange: {
        from: '2020-01-01 00:00:00',
        to: '2020-01-01 06:00:00',
        zone: 'Coordinated Universal Time',
        ...config.timeRange,
      },
    })
  );
