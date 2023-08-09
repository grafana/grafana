import React from 'react';

import { ModalsController, ToolbarButton } from '@grafana/ui';

import { GeneratePanelDrawer } from './GeneratePanelDrawer';

export const GeneratePanelButton = () => {
  return (
    <ModalsController key="button-save">
      {({ showModal, hideModal }) => (
        <ToolbarButton
          icon="ai"
          iconOnly={false}
          onClick={() => {
            showModal(GeneratePanelDrawer, { onDismiss: hideModal });
          }}
        >
          Generate Panel
        </ToolbarButton>
      )}
    </ModalsController>
  );
};
