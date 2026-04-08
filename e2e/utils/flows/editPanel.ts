import { configurePanel, type PartialEditPanelConfig } from './configurePanel';

export const editPanel = (config: Partial<PartialEditPanelConfig>) =>
  configurePanel({
    ...config,
    isEdit: true,
  });
