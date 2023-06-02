import React from 'react';

import { MenuItem, ContextMenu } from '@grafana/ui';

import { ClickedItemData } from '../types';

type Props = {
  itemData: ClickedItemData;
  onMenuItemClick: () => void;
  onItemFocus: (itemIndex: number) => void;
  onSandwich: (itemIndex: number) => void;
};

const FlameGraphContextMenu = ({ itemData, onMenuItemClick, onItemFocus, onSandwich }: Props) => {
  function renderItems() {
    return (
      <>
        <MenuItem
          label="Focus block"
          icon={'eye'}
          onClick={() => {
            onItemFocus(itemData.itemIndex);
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
          icon={'align-center-v'}
          onClick={() => {
            onSandwich(itemData.itemIndex);
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
