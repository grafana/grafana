import React, { FC, HTMLAttributes, MouseEvent, ReactElement, useCallback, useState } from 'react';

interface ClickCoordinates {
  x: number;
  y: number;
}

interface PanelHeaderMenuTriggerApi {
  panelMenuOpen: boolean;
  closeMenu: () => void;
}

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: (props: PanelHeaderMenuTriggerApi) => ReactElement;
}

export const PanelHeaderMenuTrigger: FC<Props> = ({ children, ...divProps }) => {
  const [clickCoordinates, setClickCoordinates] = useState<ClickCoordinates>({ x: 0, y: 0 });
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
    <div {...divProps} className="panel-title-container" onClick={onMenuToggle} onMouseDown={onMouseDown}>
      {children({ panelMenuOpen, closeMenu: () => setPanelMenuOpen(false) })}
    </div>
  );
};

function isClick(current: ClickCoordinates, clicked: ClickCoordinates): boolean {
  return clicked.x === current.x && clicked.y === current.y;
}

function eventToClickCoordinates(event: MouseEvent<HTMLDivElement>): ClickCoordinates {
  return {
    x: Math.floor(event.clientX),
    y: Math.floor(event.clientY),
  };
}
