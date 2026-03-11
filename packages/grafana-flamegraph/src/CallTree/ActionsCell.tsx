import { memo, useMemo } from 'react';

import { Dropdown, IconButton, Menu } from '@grafana/ui';

import { GetExtraContextMenuButtonsFunction } from '../FlameGraph/FlameGraphContextMenu';
import { FlameGraphDataContainer, LevelItem } from '../FlameGraph/dataTransform';
import { PaneView, ViewMode } from '../types';

type ActionsCellProps = {
  nodeId: string;
  label: string;
  itemIndexes: number[];
  levelItem: LevelItem;
  hasChildren: boolean;
  depth: number;
  parentId: string | undefined;
  onFocus: (nodeIdOrLabel: string, isLabel: boolean, itemIndexes: number[]) => void;
  onShowCallers: (label: string) => void;
  onSearch?: (symbol: string) => void;
  focusedNodeId: string | undefined;
  callersNodeLabel: string | undefined;
  isSearchMatch: boolean;
  actionsCellClass: string;
  getExtraContextMenuButtons?: GetExtraContextMenuButtonsFunction;
  data: FlameGraphDataContainer;
  viewMode?: ViewMode;
  paneView?: PaneView;
  search: string;
};

export const ActionsCell = memo(function ActionsCell({
  nodeId,
  label,
  itemIndexes,
  levelItem,
  hasChildren,
  depth,
  parentId,
  onFocus,
  onShowCallers,
  onSearch,
  focusedNodeId,
  callersNodeLabel,
  isSearchMatch,
  actionsCellClass,
  getExtraContextMenuButtons,
  data,
  viewMode,
  paneView,
  search,
}: ActionsCellProps) {
  const isTheFocusedNode =
    nodeId === focusedNodeId || (focusedNodeId?.startsWith('label:') && focusedNodeId.substring(6) === label);
  const isTheCallersTarget = label === callersNodeLabel;
  const inCallersMode = callersNodeLabel !== undefined;
  const inFocusMode = focusedNodeId !== undefined;
  const isRootNode = depth === 0 && !parentId;

  const shouldShowFocusItem = hasChildren && !isTheFocusedNode && !(isRootNode && !inFocusMode);
  const shouldShowCallersItem = !isTheCallersTarget && !isRootNode;
  const shouldShowSearchItem = onSearch && !isSearchMatch;

  const extraButtons = useMemo(() => {
    if (!getExtraContextMenuButtons) {
      return [];
    }
    const clickedItemData = {
      label,
      item: levelItem,
      posX: 0,
      posY: 0,
    };
    return getExtraContextMenuButtons(clickedItemData, data.data, {
      viewMode: viewMode ?? ViewMode.Single,
      paneView: paneView ?? PaneView.CallTree,
      isDiff: data.isDiffFlamegraph(),
      search,
    });
  }, [getExtraContextMenuButtons, label, levelItem, data, viewMode, paneView, search]);

  const hasAnyAction = shouldShowFocusItem || shouldShowCallersItem || shouldShowSearchItem || extraButtons.length > 0;

  if (!hasAnyAction) {
    return <div className={actionsCellClass} />;
  }

  const menu = (
    <Menu>
      {shouldShowFocusItem && (
        <Menu.Item
          label="Focus on callees"
          icon="compress-arrows"
          onClick={() => {
            if (inCallersMode) {
              onFocus(label, true, itemIndexes);
            } else {
              onFocus(nodeId, false, itemIndexes);
            }
          }}
        />
      )}
      {shouldShowCallersItem && (
        <Menu.Item label="Show callers" icon="expand-arrows-alt" onClick={() => onShowCallers(label)} />
      )}
      {shouldShowSearchItem && <Menu.Item label="Search" icon="search" onClick={() => onSearch!(label)} />}
      {extraButtons.map(({ label: btnLabel, icon, onClick }) => (
        <Menu.Item key={btnLabel} label={btnLabel} icon={icon} onClick={onClick} />
      ))}
    </Menu>
  );

  return (
    <div className={actionsCellClass}>
      <Dropdown overlay={menu}>
        <IconButton name="ellipsis-v" aria-label="Actions" size="sm" onClick={(e) => e.stopPropagation()} />
      </Dropdown>
    </div>
  );
});
