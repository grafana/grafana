import { cx } from '@emotion/css';
import { hotkeysCoreFeature, syncDataLoaderFeature } from '@headless-tree/core';
import { useTree } from '@headless-tree/react';
import { useEffect, type KeyboardEvent } from 'react';

import { t } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { Icon } from '../Icon/Icon';

import { TREE_ROOT_ID, type TreeSelectData, type TreeSelectNode } from './TreeSelect.data';
import { getTreeSelectStyles } from './TreeSelect.styles';

interface TreeSelectMenuProps {
  data: TreeSelectData;
  menuId: string;
  selectedValue?: string;
  onActivate(node: TreeSelectNode, isFolder: boolean): void;
}

export function TreeSelectMenu({ data, menuId, selectedValue, onActivate }: TreeSelectMenuProps) {
  const styles = useStyles2(getTreeSelectStyles);
  const tree = useTree<TreeSelectNode>({
    rootItemId: TREE_ROOT_ID,
    getItemName: (item) => item.getItemData().menuLabel,
    isItemFolder: (item) => item.getItemData().folder,
    dataLoader: {
      getItem: (itemId) => {
        const item = data.nodes.get(itemId);
        if (!item) {
          throw new Error(`Missing TreeSelect item: ${itemId}`);
        }
        return item;
      },
      getChildren: (itemId) => data.nodes.get(itemId)?.children ?? [],
    },
    initialState: { expandedItems: data.expandedItems },
    onPrimaryAction: (item) => {
      const node = item.getItemData();
      if (!node.disabled) {
        onActivate(node, item.isFolder());
      }
    },
    features: [syncDataLoaderFeature, hotkeysCoreFeature],
  });

  useEffect(() => {
    tree.rebuildTree();
  }, [data, tree]);

  const containerProps = tree.getContainerProps(t('grafana-ui.tree-select.tree-label', 'Available options'));
  const items = tree.getItems();
  if (items.length === 0) {
    return (
      <div {...containerProps} id={menuId} role="tree" className={styles.tree}>
        <div className={styles.empty}>{t('grafana-ui.tree-select.no-options', 'No options found.')}</div>
      </div>
    );
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    containerProps.onKeyDown?.(event);
    if (event.defaultPrevented || !['Enter', ' '].includes(event.key)) {
      return;
    }

    event.preventDefault();
    const item = tree.getFocusedItem();
    if (item.isFolder()) {
      item.isExpanded() ? item.collapse() : item.expand();
    } else {
      item.primaryAction();
    }
  };

  return (
    <div {...containerProps} id={menuId} role="tree" className={styles.tree} onKeyDown={handleKeyDown}>
      {items.map((item) => {
        const node = item.getItemData();
        const itemProps = item.getProps();
        const selected = node.value === selectedValue;

        return (
          <button
            key={item.getId()}
            {...itemProps}
            type="button"
            role="treeitem"
            aria-disabled={node.disabled || undefined}
            aria-selected={selected}
            className={cx(styles.item, selected && styles.selected, node.disabled && styles.disabled)}
            onClick={node.disabled ? undefined : itemProps.onClick}
            style={{ paddingLeft: 8 + item.getItemMeta().level * 16 }}
          >
            {item.isFolder() && <Icon name={item.isExpanded() ? 'angle-down' : 'angle-right'} />}
            <span className={styles.itemText}>
              <span className={styles.label}>{node.menuLabel}</span>
              {node.customDescription && <span className={styles.description}>{node.customDescription}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
