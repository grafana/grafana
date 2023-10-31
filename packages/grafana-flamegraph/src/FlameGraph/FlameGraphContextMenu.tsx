import React from 'react';

import { MenuItem, ContextMenu } from '@grafana/ui';

import { ClickedItemData } from '../types';

import { CollapseConfig } from './dataTransform';

type Props = {
  itemData: ClickedItemData;
  onMenuItemClick: () => void;
  onItemFocus: () => void;
  onSandwich: () => void;
  onExpandGroup: () => void;
  onCollapseGroup: () => void;
  onExpandAllGroups: () => void;
  onCollapseAllGroups: () => void;
  collapseConfig?: CollapseConfig;
};

const FlameGraphContextMenu = ({
  itemData,
  onMenuItemClick,
  onItemFocus,
  onSandwich,
  collapseConfig,
  onExpandGroup,
  onCollapseGroup,
  onExpandAllGroups,
  onCollapseAllGroups,
}: Props) => {
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
        {collapseConfig ? (
          collapseConfig.collapsed ? (
            <MenuItem
              label="Expand group"
              icon={'angle-double-down'}
              onClick={() => {
                onExpandGroup();
                onMenuItemClick();
              }}
            />
          ) : (
            <MenuItem
              label="Collapse group"
              icon={'angle-double-up'}
              onClick={() => {
                onCollapseGroup();
                onMenuItemClick();
              }}
            />
          )
        ) : null}
        <MenuItem
          label="Expand all groups"
          icon={'angle-double-down'}
          onClick={() => {
            onExpandAllGroups();
            onMenuItemClick();
          }}
        />
        <MenuItem
          label="Collapse all groups"
          icon={'angle-double-up'}
          onClick={() => {
            onCollapseAllGroups();
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
