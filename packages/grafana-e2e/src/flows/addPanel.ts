import { v4 as uuidv4 } from 'uuid';

import { getScenarioContext } from '../support/scenarioContext';

import { configurePanel, PartialAddPanelConfig } from './configurePanel';

export const addPanel = (config?: Partial<PartialAddPanelConfig>) =>
  getScenarioContext().then(({ lastAddedDataSource }: any) =>
    configurePanel({
      dataSourceName: lastAddedDataSource,
      panelTitle: `e2e-${uuidv4()}`,
      ...config,
      isEdit: false,
    })
  );
