import React, { HTMLAttributes, MouseEvent, ReactElement, useCallback, useRef, useState } from 'react';

import { CartesianCoords2D } from '@grafana/data';

interface PanelHeaderMenuTriggerApi {
  panelMenuOpen: boolean;
  closeMenu: () => void;
}

interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  children: (props: PanelHeaderMenuTriggerApi) => ReactElement;
  onOpenMenu?: () => void;
}

export function PanelHeaderMenuTrigger({ children, onOpenMenu, ...divProps }: Props) {
  const clickCoordinates = useRef<CartesianCoords2D>({ x: 0, y: 0 });
  const [panelMenuOpen, setPanelMenuOpen] = useState<boolean>(false);

  const onMenuToggle = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!isClick(clickCoordinates.current, eventToClickCoordinates(event))) {
        return;
      }

      setPanelMenuOpen(!panelMenuOpen);
      if (panelMenuOpen) {
        onOpenMenu?.();
      }
    },
    [panelMenuOpen, setPanelMenuOpen, onOpenMenu]
  );

  const onMouseDown = useCallback((event: MouseEvent<HTMLDivElement>) => {
    clickCoordinates.current = eventToClickCoordinates(event);
  }, []);

  return (
    // TODO: fix keyboard a11y
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
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
