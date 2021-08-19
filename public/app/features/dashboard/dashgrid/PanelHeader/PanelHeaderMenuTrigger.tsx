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
      if (!isClick(clickCoordinates, eventToClickCoordinates(event))) {
        return;
      }

      event.stopPropagation();

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

function isClick(current: CartesianCoords2D, clicked: CartesianCoords2D): boolean {
  return clicked.x === current.x && clicked.y === current.y;
}

function eventToClickCoordinates(event: MouseEvent<HTMLDivElement>): CartesianCoords2D {
  return {
    x: Math.floor(event.clientX),
    y: Math.floor(event.clientY),
  };
}
