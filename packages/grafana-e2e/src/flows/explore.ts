import { configurePanel, ConfigurePanelConfig } from './configurePanel';
import { getScenarioContext } from '../support/scenarioContext';

// @todo `Omit` 'dashboardUid' and 'panelTitle'
export interface ExploreConfig extends ConfigurePanelConfig {
  queriesForm: (config: ExploreConfig) => void;
}

// @todo improve config input/output: https://stackoverflow.com/a/63507459/923745
// @todo this actually returns type `Cypress.Chainable`
export const explore = (config: Partial<ExploreConfig>): any =>
  getScenarioContext().then(({ lastAddedDataSource }: any) =>
    configurePanel(
      {
        dataSourceName: lastAddedDataSource,
        isExplore: true,
        screenshotName: 'explore-graph',
        ...config,
        timeRange: {
          from: '2020-01-01 00:00:00',
          to: '2020-01-01 06:00:00',
          zone: 'Coordinated Universal Time',
          ...config.timeRange,
        },
      } as ExploreConfig,
      false
    )
  );
