import React, { FC } from 'react';
import { PageToolbar, ToolbarButton } from '@grafana/ui';

type Props = {};

const AlertEditor: FC<Props> = (props) => {
  return (
    <div>
      <PageToolbar title="Create alert rule" pageIcon="bell">
        <ToolbarButton variant="primary">Save</ToolbarButton>
        <ToolbarButton variant="default">Save and exit</ToolbarButton>
        <ToolbarButton variant="destructive">Cancel</ToolbarButton>
      </PageToolbar>
    </div>
  );
};

export default AlertEditor;
