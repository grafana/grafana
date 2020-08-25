import { configurePanel, ConfigurePanelConfig } from './configurePanel';
import { getScenarioContext } from '../support/scenarioContext';

export interface AddPanelConfig extends ConfigurePanelConfig {
  dataSourceName: string;
  queriesForm: (config: AddPanelConfig) => void;
  panelTitle: string;
  visualizationName: string;
}

// @todo improve config input/output: https://stackoverflow.com/a/63507459/923745
// @todo this actually returns type `Cypress.Chainable`
export const addPanel = (config?: Partial<AddPanelConfig>): any =>
  getScenarioContext().then(({ lastAddedDataSource }: any) =>
    configurePanel(
      {
        dataSourceName: lastAddedDataSource,
        panelTitle: `e2e-${Date.now()}`,
        visualizationName: 'Table',
        ...config,
      } as AddPanelConfig,
      false
    )
  );
