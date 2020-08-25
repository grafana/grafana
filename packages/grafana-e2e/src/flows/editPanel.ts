import { configurePanel, ConfigurePanelConfig } from './configurePanel';

export interface EditPanelConfig extends ConfigurePanelConfig {
  queriesForm?: (config: EditPanelConfig) => void;
}

// @todo improve config input/output: https://stackoverflow.com/a/63507459/923745
// @todo this actually returns type `Cypress.Chainable`
export const editPanel = (config: Partial<EditPanelConfig>): any => configurePanel(config, true);
