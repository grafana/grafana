import React from 'react';

import { MenuItem, ContextMenu } from '@grafana/ui';

import { ClickedItemData } from '../types';

type Props = {
  itemData: ClickedItemData;
  onMenuItemClick: () => void;
  onItemFocus: () => void;
  onSandwich: () => void;
};

const FlameGraphContextMenu = ({ itemData, onMenuItemClick, onItemFocus, onSandwich }: Props) => {
  function renderItems() {
    return (
      <>
        <MenuItem
          label="Focus block"
          icon={'eye'}
          onClick={() => {
            onItemFocus();
            onMenuItemClick();
          }}
        />
        <MenuItem
          label="Copy function name"
          icon={'copy'}
          onClick={() => {
            navigator.clipboard.writeText(itemData.label).then(() => {
              onMenuItemClick();
            });
          }}
        />
        <MenuItem
          label="Sandwich view"
          icon={'gf-show-context'}
          onClick={() => {
            onSandwich();
            onMenuItemClick();
          }}
        />
      </>
    );
  }

  return (
    <div data-testid="contextMenu">
      <ContextMenu
        renderMenuItems={renderItems}
        x={itemData.posX + 10}
        y={itemData.posY}
        focusOnOpen={false}
      ></ContextMenu>
    </div>
  );
};

export default FlameGraphContextMenu;
