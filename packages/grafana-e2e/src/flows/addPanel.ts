import { configurePanel, ConfigurePanelConfig } from './configurePanel';
import { getScenarioContext } from '../support/scenarioContext';
import { v4 as uuidv4 } from 'uuid';

// @todo `Omit` 'isExplore'
export interface AddPanelConfig extends ConfigurePanelConfig {
  dataSourceName: string;
  queriesForm: (config: AddPanelConfig) => void;
  visualizationName: string;
}

// @todo improve config input/output: https://stackoverflow.com/a/63507459/923745
// @todo this actually returns type `Cypress.Chainable`
export const addPanel = (config?: Partial<AddPanelConfig>): any =>
  getScenarioContext().then(({ lastAddedDataSource }: any) =>
    configurePanel(
      {
        dataSourceName: lastAddedDataSource,
        panelTitle: `e2e-${uuidv4()}`,
        ...config,
      } as AddPanelConfig,
      false
    )
  );
