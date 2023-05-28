import React from 'react';

import { MenuItem, ContextMenu } from '@grafana/ui';

import { ClickedItemData } from '../types';

type Props = {
  itemData: ClickedItemData;
  onMenuItemClick: () => void;
  onItemFocus: (itemIndex: number) => void;
};

const FlameGraphContextMenu = ({ itemData, onMenuItemClick, onItemFocus }: Props) => {
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
