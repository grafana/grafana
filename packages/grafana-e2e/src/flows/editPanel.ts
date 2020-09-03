import { configurePanel, PartialEditPanelConfig } from './configurePanel';

export const editPanel = (config: Partial<PartialEditPanelConfig>) =>
  configurePanel({
    ...config,
    isEdit: true,
    isExplore: false,
  });
