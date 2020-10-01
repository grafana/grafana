import React, { useState, useCallback, useRef } from 'react';
import { ClickPlugin } from './ClickPlugin';
import { Portal } from '../../Portal/Portal';
import { css } from 'emotion';
import useClickAway from 'react-use/lib/useClickAway';

interface ContextMenuPluginProps {
  onOpen?: () => void;
  onClose?: () => void;
}

export const ContextMenuPlugin: React.FC<ContextMenuPluginProps> = ({ onClose }) => {
  const [isOpen, setIsOpen] = useState(false);

  const onClick = useCallback(() => {
    setIsOpen(!isOpen);
  }, [setIsOpen]);

  return (
    <ClickPlugin id="ContextMenu" onClick={onClick}>
      {({ point, coords, clearSelection }) => {
        return (
          <Portal>
            <ContextMenu
              selection={{ point, coords }}
              onClose={() => {
                clearSelection();
                if (onClose) {
                  onClose();
                }
              }}
            />
          </Portal>
        );
      }}
    </ClickPlugin>
  );
};

interface ContextMenuProps {
  onClose?: () => void;
  selection: any;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ onClose, selection }) => {
  const ref = useRef(null);

  useClickAway(ref, () => {
    if (onClose) {
      onClose();
    }
  });

  return (
    <div
      ref={ref}
      className={css`
        background: yellow;
        position: absolute;
        // rendering in Portal, hence using viewport coords
        top: ${selection.coords.viewport.y + 10}px;
        left: ${selection.coords.viewport.x + 10}px;
      `}
    >
      Point: {JSON.stringify(selection.point)} <br />
      Viewport coords: {JSON.stringify(selection.coords.viewport)}
    </div>
  );
};
