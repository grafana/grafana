import React, { FC, HTMLAttributes, MouseEvent, ReactElement, useCallback, useState } from 'react';

import { CartesianCoords2D } from '@grafana/data';

interface PanelHeaderMenuTriggerApi {
  panelMenuOpen: boolean;
  closeMenu: () => void;
}

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: (props: PanelHeaderMenuTriggerApi) => ReactElement;
}

export const PanelHeaderMenuTrigger: FC<Props> = ({ children, ...divProps }) => {
  const [clickCoordinates, setClickCoordinates] = useState<CartesianCoords2D>({ x: 0, y: 0 });
  const [panelMenuOpen, setPanelMenuOpen] = useState<boolean>(false);

  const onMenuToggle = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!isClick(clickCoordinates, { x: event.clientX, y: event.clientY })) {
        return;
      }

      setPanelMenuOpen(!panelMenuOpen);
    },
    [clickCoordinates, panelMenuOpen, setPanelMenuOpen]
  );

  const onMouseDown = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      setClickCoordinates(eventToClickCoordinates(event));
    },
    [setClickCoordinates]
  );

  return (
    <header {...divProps} className="panel-title-container" onClick={onMenuToggle} onMouseDown={onMouseDown}>
      {children({ panelMenuOpen, closeMenu: () => setPanelMenuOpen(false) })}
    </header>
  );
};

function isClick(current: CartesianCoords2D, clicked: CartesianCoords2D, deadZone = 3.5): boolean {
  const clickDistance = Math.sqrt((current.x - clicked.x) ** 2 + (current.y - clicked.y) ** 2);
  return clickDistance <= deadZone;
}

function eventToClickCoordinates(event: MouseEvent<HTMLDivElement>): CartesianCoords2D {
  return {
    x: event.clientX,
    y: event.clientY,
  };
}
