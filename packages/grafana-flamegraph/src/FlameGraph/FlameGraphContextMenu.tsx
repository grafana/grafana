import React from 'react';

import { MenuItem, MenuGroup, ContextMenu, IconName } from '@grafana/ui';

import { ClickedItemData } from '../types';

import { CollapseConfig } from './dataTransform';

export type ExtraContextMenuButton = {
  label: string;
  icon: IconName;
  onClick: (clickedItemData: ClickedItemData) => void;
};

type Props = {
  itemData: ClickedItemData;
  onMenuItemClick: () => void;
  onItemFocus: () => void;
  onSandwich: () => void;
  onExpandGroup: () => void;
  onCollapseGroup: () => void;
  onExpandAllGroups: () => void;
  onCollapseAllGroups: () => void;
  extraContextMenuButtons?: ExtraContextMenuButton[];
  collapseConfig?: CollapseConfig;
  collapsing?: boolean;
  allGroupsCollapsed?: boolean;
  allGroupsExpanded?: boolean;
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
  extraContextMenuButtons,
  collapsing,
  allGroupsExpanded,
  allGroupsCollapsed,
}: Props) => {
  function renderItems() {
    console.log('extraContextMenuButtons', extraContextMenuButtons)
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
        {
          (extraContextMenuButtons || []).map(({ label, icon, onClick }) => {
            return <MenuItem
              label={label}
              icon={icon}
              onClick={() => onClick(itemData)}
              key={label}
            />
          })
        }
        {collapsing && (
          <MenuGroup label={'Grouping'}>
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
            {!allGroupsExpanded && (
              <MenuItem
                label="Expand all groups"
                icon={'angle-double-down'}
                onClick={() => {
                  onExpandAllGroups();
                  onMenuItemClick();
                }}
              />
            )}
            {!allGroupsCollapsed && (
              <MenuItem
                label="Collapse all groups"
                icon={'angle-double-up'}
                onClick={() => {
                  onCollapseAllGroups();
                  onMenuItemClick();
                }}
              />
            )}
          </MenuGroup>
        )}
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
