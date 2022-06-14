import React, { FC } from 'react';

import { ClickOutsideWrapper } from '@grafana/ui';

import { DashboardModel, PanelModel } from '../../state';

import { PanelHeaderMenu } from './PanelHeaderMenu';
import { PanelHeaderMenuProvider } from './PanelHeaderMenuProvider';

interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  show: boolean;
  onClose: () => void;
}

export const PanelHeaderMenuWrapper: FC<Props> = ({ show, onClose, panel, dashboard }) => {
  if (!show) {
    return null;
  }

  return (
    <ClickOutsideWrapper onClick={onClose} parent={document}>
      <PanelHeaderMenuProvider panel={panel} dashboard={dashboard}>
        {({ items }) => {
          return <PanelHeaderMenu items={items} />;
        }}
      </PanelHeaderMenuProvider>
    </ClickOutsideWrapper>
  );
};
