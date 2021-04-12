import React, { FC } from 'react';
import { ClickOutsideWrapper, Portal } from '@grafana/ui';
import { PanelHeaderMenuProvider } from './PanelHeaderMenuProvider';
import { PanelHeaderMenu } from './PanelHeaderMenu';
import { DashboardModel, PanelModel } from '../../state';
import { CartesianCoords2D, Dimensions2D } from '@grafana/data';

interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  show: boolean;
  onClose: () => void;
  coordinates?: CartesianCoords2D;
  dimensions?: Dimensions2D;
}

export const PanelHeaderMenuWrapper: FC<Props> = ({ show, onClose, panel, dashboard, coordinates, dimensions }) => {
  if (!show) {
    return null;
  }

  return (
    <Portal>
      <ClickOutsideWrapper onClick={onClose} parent={document}>
        <PanelHeaderMenuProvider panel={panel} dashboard={dashboard}>
          {({ items }) => {
            return <PanelHeaderMenu items={items} coordinates={coordinates} dimensions={dimensions} />;
          }}
        </PanelHeaderMenuProvider>
      </ClickOutsideWrapper>
    </Portal>
  );
};
