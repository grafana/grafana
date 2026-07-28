import { css, cx } from '@emotion/css';
import { useMemo, useState } from 'react';

import { fuzzySearch, type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { type SceneObject } from '@grafana/scenes';
import { Icon, Text, useElementSelection, useStyles2 } from '@grafana/ui';

import { DashboardLinksSet } from '../../settings/links/DashboardLinksSet';
import { LinkEdit } from '../../settings/links/LinkAddEditableElement';
import { DashboardFiltersSet } from '../../settings/variables/DashboardFiltersSet';
import { SectionFiltersSet } from '../../settings/variables/SectionFiltersSet';
import { isRepeatCloneOrChildOf } from '../../utils/clone';
import { DashboardInteractions } from '../../utils/interactions';
import { getEditableElementFor } from '../shared';
import { type DashboardEditPaneLike } from '../types';
import { useOutlineRename } from '../useOutlineRename';

import { type DashboardOutline } from './DashboardOutline';
import { DashboardOutlineNodeButtonContent } from './DashboardOutlineNodeButtonContent';

interface DashboardOutlineNodeProps {
  sceneObject: SceneObject;
  editPane: DashboardEditPaneLike;
  outline: DashboardOutline;
  isEditing: boolean | undefined;
  depth: number;
  index: number;
  searchMatchKeys?: Set<string>;
  searchVisibleKeys?: Set<string>;
}

export function DashboardOutlineNode({
  sceneObject,
  editPane,
  outline,
  isEditing,
  depth,
  index,
  searchMatchKeys,
  searchVisibleKeys,
}: DashboardOutlineNodeProps) {
  const styles = useStyles2(getStyles);
  const key = sceneObject.state.key;
  const [isCollapsed, setIsCollapsed] = useState(() => outline.isNodeCollapsed(key, depth > 0));
  const { isSelected, onSelect } = useElementSelection(key);
  const isCloned = useMemo(() => isRepeatCloneOrChildOf(sceneObject), [sceneObject]);
  const editableElement = useMemo(() => getEditableElementFor(sceneObject)!, [sceneObject]);

  const noTitleText = t('dashboard.outline.tree-item.no-title', '<no title>');

  const elementInfo = editableElement.getEditableElementInfo();
  const instanceName = elementInfo.instanceName || noTitleText;
  const outlineRename = useOutlineRename(editableElement, isEditing);
  const isContainer = editableElement.getOutlineChildren ? true : false;
  const visibleChildren = useMemo(
    () => getVisibleOutlineChildren(sceneObject, Boolean(isEditing)),
    [sceneObject, isEditing]
  );

  const isSearching = searchVisibleKeys !== undefined;
  const isSearchMatch = isSearching && key !== undefined && searchMatchKeys?.has(key);
  const filteredChildren = isSearching
    ? visibleChildren.filter((child) => child.state.key !== undefined && searchVisibleKeys.has(child.state.key))
    : visibleChildren;
  const effectiveCollapsed = isSearching ? false : isCollapsed;

  const onNodeClicked = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!isSelected) {
      if (
        sceneObject instanceof LinkEdit ||
        sceneObject instanceof DashboardLinksSet ||
        sceneObject instanceof DashboardFiltersSet ||
        sceneObject instanceof SectionFiltersSet
      ) {
        // Select directly via editPane.selectObject because these objects are not
        // in the scene graph, so sceneGraph.findByKey (used by onSelect) can't find them.
        editPane.selectObject(sceneObject);
      } else {
        onSelect?.(e);
      }
    }

    editableElement.scrollIntoView?.();
    DashboardInteractions.outlineItemClicked({ index, depth, isEditing });
  };

  const onToggleCollapse = (evt: React.MouseEvent) => {
    evt.stopPropagation();
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    outline.setNodeCollapsed(key, newCollapsed);
  };

  if (isSearching && depth > 0 && (!key || !searchVisibleKeys.has(key))) {
    return null;
  }

  if (elementInfo.isHidden && !isEditing) {
    return null;
  }

  return (
    // todo: add proper keyboard navigation
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events
    <li
      role="treeitem"
      aria-selected={isSelected}
      className={styles.wrapper}
      onClick={onNodeClicked}
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      style={{ '--depth': depth } as React.CSSProperties}
    >
      <div
        className={cx(styles.row, isEditing ? styles.rowEditMode : styles.rowViewMode, {
          [styles.rowSelected]: isSelected,
          [styles.searchMatch]: isSearchMatch,
        })}
      >
        <div className={styles.indentation}></div>
        {isContainer && !isSearching && (
          <button
            className={styles.angleButton}
            onClick={onToggleCollapse}
            data-testid={selectors.components.PanelEditor.Outline.node(instanceName)}
          >
            <Icon name={isCollapsed ? 'angle-right' : 'angle-down'} />
          </button>
        )}
        <button
          className={cx(styles.nodeButton, { [styles.nodeButtonClone]: isCloned })}
          onDoubleClick={outlineRename.onNameDoubleClicked}
          data-testid={selectors.components.PanelEditor.Outline.item(instanceName)}
        >
          <Icon size="sm" name={elementInfo.icon} />
          <DashboardOutlineNodeButtonContent
            elementInfo={elementInfo}
            instanceName={instanceName}
            isCloned={isCloned}
            isRenaming={outlineRename.isRenaming}
            renameInputRef={outlineRename.renameInputRef}
            onChangeName={outlineRename.onChangeName}
            onInputBlur={outlineRename.onInputBlur}
            onInputKeyDown={outlineRename.onInputKeyDown}
          />
        </button>
      </div>

      {isContainer && !effectiveCollapsed && (filteredChildren.length > 0 || !isSearching) && (
        <ul className={styles.nodeChildren} role="group">
          {filteredChildren.length > 0 ? (
            filteredChildren.map((child, i) => (
              <DashboardOutlineNode
                key={child.state.key}
                sceneObject={child}
                editPane={editPane}
                outline={outline}
                depth={depth + 1}
                isEditing={isEditing}
                index={i}
                searchMatchKeys={searchMatchKeys}
                searchVisibleKeys={searchVisibleKeys}
              />
            ))
          ) : (
            <li
              role="treeitem"
              aria-selected={isSelected}
              className={styles.wrapper}
              // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
              style={{ '--depth': depth + 1 } as React.CSSProperties}
            >
              <div className={styles.row}>
                <div className={styles.indentation}></div>
                <Text color="secondary" italic>
                  <Trans i18nKey="dashboard.outline.tree-item.empty">(empty)</Trans>
                </Text>
              </div>
            </li>
          )}
        </ul>
      )}
    </li>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      display: 'flex',
      gap: theme.spacing(0.5),
      flexGrow: 1,
      flexDirection: 'column',
      borderRadius: theme.shape.radius.default,
      color: theme.colors.text.secondary,
    }),
    indentation: css({
      marginLeft: `calc(var(--depth) * ${theme.spacing(3)})`,
    }),
    searchMatch: css({
      color: theme.colors.text.primary,
    }),
    angleButton: css({
      boxShadow: 'none',
      border: 'none',
      background: 'transparent',
      borderRadius: theme.shape.radius.default,
      padding: 0,
      color: 'inherit',
      lineHeight: 0,
    }),
    nodeChildren: css({
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      gap: theme.spacing(0.5),

      // tree line
      '&::before': {
        content: '""',
        position: 'absolute',
        width: '1px',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1,
        background: theme.colors.border.weak,
        marginLeft: `calc(11px + ${theme.spacing(3)} * var(--depth))`,
      },
    }),
    row: css({
      display: 'flex',
      gap: theme.spacing(0.5),
      borderRadius: theme.shape.radius.default,
    }),
    rowEditMode: css({
      '&:hover': {
        color: theme.colors.text.primary,
        outline: `1px dashed ${theme.colors.border.strong}`,
        backgroundColor: theme.colors.emphasize(theme.colors.background.primary, 0.05),
      },
    }),
    rowViewMode: css({
      '&:hover': {
        textDecoration: 'underline',
      },
    }),
    rowSelected: css({
      color: theme.colors.text.primary,
      outline: `1px dashed ${theme.colors.accent.main} !important`,
      backgroundColor: theme.colors.emphasize(theme.colors.background.primary, 0.05),
    }),
    nodeButton: css({
      boxShadow: 'none',
      border: 'none',
      background: 'transparent',
      padding: 0,
      borderRadius: theme.shape.radius.default,
      color: 'inherit',
      display: 'flex',
      flexGrow: 1,
      alignItems: 'center',
      gap: theme.spacing(0.5),
      overflow: 'hidden',
      '> span': {
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      },
    }),
    nodeButtonClone: css({
      color: theme.colors.text.secondary,
    }),
  };
}

function getVisibleOutlineChildren(sceneObject: SceneObject, isEditing: boolean): SceneObject[] {
  const editableElement = getEditableElementFor(sceneObject);
  if (!editableElement?.getOutlineChildren) {
    return [];
  }

  const outlineChildren = editableElement.getOutlineChildren(isEditing) ?? [];
  if (isEditing) {
    return outlineChildren;
  }

  return outlineChildren.filter((child) => !getEditableElementFor(child)?.getEditableElementInfo().isHidden);
}

export interface SearchMatchResult {
  matchingKeys: Set<string>;
  visibleKeys: Set<string>;
}

export function computeSearchMatches(
  root: SceneObject,
  searchQuery: string,
  isEditing: boolean,
  noTitleText: string
): SearchMatchResult {
  const nodeKeys: string[] = [];
  const haystack: string[] = [];

  function collectNodes(node: SceneObject, depth: number) {
    const editableElement = getEditableElementFor(node);
    if (!editableElement) {
      return;
    }

    const elementInfo = editableElement.getEditableElementInfo();
    if (elementInfo.isHidden && !isEditing) {
      return;
    }

    const key = node.state.key;
    if (depth > 0 && key) {
      const instanceName = elementInfo.instanceName || noTitleText;
      const description =
        'description' in node.state && typeof node.state.description === 'string' ? node.state.description : '';
      nodeKeys.push(key);
      haystack.push(`${instanceName} ${elementInfo.typeName} ${description}`);
    }

    for (const child of getVisibleOutlineChildren(node, isEditing)) {
      collectNodes(child, depth + 1);
    }
  }

  collectNodes(root, 0);

  const matchingKeys = new Set<string>();
  for (const idx of fuzzySearch(haystack, searchQuery)) {
    matchingKeys.add(nodeKeys[idx]);
  }

  const visibleKeys = new Set<string>();

  function computeAncestry(node: SceneObject): boolean {
    const editableElement = getEditableElementFor(node);
    if (!editableElement) {
      return false;
    }

    const elementInfo = editableElement.getEditableElementInfo();
    if (elementInfo.isHidden && !isEditing) {
      return false;
    }

    const key = node.state.key;
    const isMatch = key !== undefined && matchingKeys.has(key);

    let hasMatchingDescendant = false;
    for (const child of getVisibleOutlineChildren(node, isEditing)) {
      if (computeAncestry(child)) {
        hasMatchingDescendant = true;
      }
    }

    if ((isMatch || hasMatchingDescendant) && key) {
      visibleKeys.add(key);
      return true;
    }

    return false;
  }

  computeAncestry(root);
  return { matchingKeys, visibleKeys };
}
