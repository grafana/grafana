import React, { HTMLAttributes, MouseEvent, ReactElement, useCallback, useRef, useState } from 'react';

import { CartesianCoords2D } from '@grafana/data';

interface PanelHeaderMenuTriggerApi {
  panelMenuOpen: boolean;
  closeMenu: () => void;
}

interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  children: (props: PanelHeaderMenuTriggerApi) => ReactElement;
}

export function PanelHeaderMenuTrigger({ children, ...divProps }: Props) {
  const clickCoordinates = useRef<CartesianCoords2D>({ x: 0, y: 0 });
  const [panelMenuOpen, setPanelMenuOpen] = useState<boolean>(false);

  const onMenuToggle = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!isClick(clickCoordinates.current, eventToClickCoordinates(event))) {
        return;
      }

      setPanelMenuOpen(!panelMenuOpen);
    },
    [panelMenuOpen, setPanelMenuOpen]
  );

  const onMouseDown = useCallback((event: MouseEvent<HTMLDivElement>) => {
    clickCoordinates.current = eventToClickCoordinates(event);
  }, []);

  return (
    <header {...divProps} className="panel-title-container" onClick={onMenuToggle} onMouseDown={onMouseDown}>
      {children({ panelMenuOpen, closeMenu: () => setPanelMenuOpen(false) })}
    </header>
  );
}

function isClick(current: CartesianCoords2D, clicked: CartesianCoords2D, deadZone = 3.5): boolean {
  // A "deadzone" radius is added so that if the cursor is moved within this radius
  // between mousedown and mouseup, it's still considered a click and not a drag.
  const clickDistance = Math.sqrt((current.x - clicked.x) ** 2 + (current.y - clicked.y) ** 2);
  return clickDistance <= deadZone;
}

function eventToClickCoordinates(event: MouseEvent<HTMLDivElement>): CartesianCoords2D {
  return {
    x: event.clientX,
    y: event.clientY,
  };
}
