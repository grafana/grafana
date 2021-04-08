import React, { FC, useLayoutEffect, useState, useRef } from 'react';
import { ClickOutsideWrapper, Portal } from '@grafana/ui';
import { useClickAway } from 'react-use';
import { PanelHeaderMenuProvider } from './PanelHeaderMenuProvider';
import { PanelHeaderMenu } from './PanelHeaderMenu';
import { DashboardModel, PanelModel } from '../../state';

interface Props {
  /** Starting horizontal position for the panel header menu */
  x: number;
  /** Starting vertical position for the panel header menu */
  y: number;
  panel: PanelModel;
  dashboard: DashboardModel;
  show: boolean;
  onClose: () => void;
}

export const PanelHeaderMenuWrapper: FC<Props> = ({ show, x, y, onClose, panel, dashboard }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [positionStyles, setPositionStyles] = useState({});

  useLayoutEffect(() => {
    const menuElement = menuRef.current;
    if (menuElement) {
      const rect = menuElement.getBoundingClientRect();
      const OFFSET = 5;
      const collisions = {
        right: window.innerWidth < x + rect.width,
        bottom: window.innerHeight < rect.bottom + rect.height + OFFSET,
      };

      setPositionStyles({
        position: 'fixed',
        left: collisions.right ? x - rect.width - OFFSET : x - OFFSET,
        top: collisions.bottom ? y - rect.height - OFFSET : y + OFFSET,
      });
    }
  }, [x, y]);

  useClickAway(menuRef, () => {
    if (onClose) {
      onClose();
    }
  });

  if (!show) {
    return null;
  }

  return (
    <Portal>
      <ClickOutsideWrapper onClick={onClose} parent={document}>
        <PanelHeaderMenuProvider panel={panel} dashboard={dashboard}>
          {({ items }) => {
            return <PanelHeaderMenu items={items} ref={menuRef} style={positionStyles} />;
          }}
        </PanelHeaderMenuProvider>
      </ClickOutsideWrapper>
    </Portal>
  );
};
