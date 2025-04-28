import { css, cx } from '@emotion/css';
import { sortBy } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneObject } from '@grafana/scenes';
import { Box, Icon, Text, useElementSelection, useStyles2, useTheme2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { EditableDashboardElement } from '../scene/types/EditableDashboardElement';
import { isInCloneChain } from '../utils/clone';
import { getDashboardSceneFor } from '../utils/utils';

import { DashboardEditPane } from './DashboardEditPane';
import { getEditableElementFor } from './shared';
import { useOutlineRename } from './useOutlineRename';

export interface Props {
  editPane: DashboardEditPane;
}

export function DashboardOutline({ editPane }: Props) {
  const dashboard = getDashboardSceneFor(editPane);

  return (
    <Box padding={1} gap={0} display="flex" direction="column">
      <DashboardOutlineNode sceneObject={dashboard} editPane={editPane} depth={0} />
    </Box>
  );
}

function DashboardOutlineNode({
  sceneObject,
  editPane,
  depth,
}: {
  sceneObject: SceneObject;
  editPane: DashboardEditPane;
  depth: number;
}) {
  const [isCollapsed, setIsCollapsed] = useState(depth > 0);
  const theme = useTheme2();
  const { key } = sceneObject.useState();
  const styles = useStyles2(getStyles);
  const { isSelected, onSelect } = useElementSelection(key);
  const isCloned = useMemo(() => isInCloneChain(key!), [key]);
  const editableElement = useMemo(() => getEditableElementFor(sceneObject)!, [sceneObject]);

  const children = sortBy(collectEditableElementChildren(sceneObject, [], 0), 'depth');
  const elementInfo = editableElement.getEditableElementInfo();
  const noTitleText = t('dashboard.outline.tree-item.no-title', '<no title>');
  const instanceName = elementInfo.instanceName === '' ? noTitleText : elementInfo.instanceName;
  const elementCollapsed = editableElement.getCollapsedState?.();
  const outlineRename = useOutlineRename(editableElement);

  const onNodeClicked = (evt: React.PointerEvent) => {
    // Only select via clicking outline never deselect
    if (!isSelected) {
      onSelect?.(evt);
    }

    editableElement.scrollIntoView?.();
  };

  const onToggleCollapse = (evt: React.MouseEvent) => {
    evt.stopPropagation();
    setIsCollapsed(!isCollapsed);

    // Sync expanded state with canvas element
    if (editableElement.getCollapsedState) {
      editableElement.setCollapsedState?.(!isCollapsed);
    }
  };

  // Sync canvas element expanded state with outline element
  useEffect(() => {
    if (elementCollapsed != null && elementCollapsed !== isCollapsed) {
      setIsCollapsed(elementCollapsed);
    }
  }, [isCollapsed, elementCollapsed]);

  return (
    <>
      <div
        className={cx(styles.container, isSelected && styles.containerSelected)}
        style={{ paddingLeft: theme.spacing(depth * 3) }}
        onPointerDown={onNodeClicked}
      >
        {elementInfo.isContainer && (
          <button role="treeitem" className={styles.angleButton} onPointerDown={onToggleCollapse}>
            <Icon name={!isCollapsed ? 'angle-down' : 'angle-right'} />
          </button>
        )}
        <button
          role="button"
          className={cx(styles.nodeName, isCloned && styles.nodeNameClone)}
          onDoubleClick={outlineRename.onNameDoubleClicked}
        >
          <Icon size="sm" name={elementInfo.icon} />
          {outlineRename.isRenaming ? (
            <input
              ref={outlineRename.renameInputRef}
              type="text"
              value={elementInfo.instanceName}
              className={styles.outlineInput}
              onChange={outlineRename.onChangeName}
              onBlur={outlineRename.onInputBlur}
              onKeyDown={outlineRename.onInputKeyDown}
            />
          ) : (
            <>
              <span>{instanceName}</span>
              {elementInfo.isHidden && <Icon name="eye-slash" size="sm" className={styles.hiddenIcon} />}
              {elementInfo.isContainer && isCollapsed && <span>({children.length})</span>}
            </>
          )}
        </button>
      </div>

      {elementInfo.isContainer && !isCollapsed && (
        <div className={styles.nodeChildren}>
          <div className={styles.nodeChildrenLine} style={{ marginLeft: theme.spacing(depth * 3) }} />
          {children.length > 0 ? (
            children.map((child) => (
              <DashboardOutlineNode
                key={child.sceneObject.state.key}
                sceneObject={child.sceneObject}
                editPane={editPane}
                depth={depth + 1}
              />
            ))
          ) : (
            <Text color="secondary">
              <Trans i18nKey="dashboard.outline.tree-item.empty">(empty)</Trans>
            </Text>
          )}
        </div>
      )}
    </>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      gap: theme.spacing(0.5),
      alignItems: 'center',
      flexGrow: 1,
      borderRadius: theme.shape.radius.default,
      position: 'relative',
      marginBottom: theme.spacing(0.25),
      color: theme.colors.text.secondary,
      '&:hover': {
        color: theme.colors.text.primary,
        outline: `1px dashed ${theme.colors.border.strong}`,
        outlineOffset: '0px',
        backgroundColor: theme.colors.emphasize(theme.colors.background.primary, 0.05),
      },
    }),
    containerSelected: css({
      outline: `1px dashed ${theme.colors.primary.border} !important`,
      outlineOffset: '0px',
      color: theme.colors.text.primary,

      '&:hover': {
        outline: `1px dashed ${theme.colors.primary.border}`,
        color: theme.colors.text.primary,
      },
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
    nodeName: css({
      boxShadow: 'none',
      border: 'none',
      background: 'transparent',
      padding: theme.spacing(0.25, 1, 0.25, 0),
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
    hiddenIcon: css({
      color: theme.colors.text.secondary,
      marginLeft: theme.spacing(1),
    }),
    nodeNameClone: css({
      color: theme.colors.text.secondary,
      cursor: 'not-allowed',
    }),
    outlineInput: css({
      border: `1px solid ${theme.components.input.borderColor}`,
      height: theme.spacing(3),
      borderRadius: theme.shape.radius.default,

      '&:focus': {
        outline: 'none',
        boxShadow: 'none',
      },
    }),
    nodeChildren: css({
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
    }),
    nodeChildrenLine: css({
      position: 'absolute',
      width: '1px',
      height: '100%',
      left: '7px',
      zIndex: 1,
      backgroundColor: theme.colors.border.weak,
    }),
  };
}

interface EditableElementConfig {
  sceneObject: SceneObject;
  editableElement: EditableDashboardElement;
  depth: number;
}

function collectEditableElementChildren(
  sceneObject: SceneObject,
  children: EditableElementConfig[],
  depth: number
): EditableElementConfig[] {
  sceneObject.forEachChild((child) => {
    const editableElement = getEditableElementFor(child);

    if (editableElement) {
      children.push({ sceneObject: child, editableElement, depth });
      return;
    }

    if (child instanceof DashboardGridItem) {
      // DashboardGridItem is a special case as it can contain repeated panels
      // In this case, we want to show the repeated panels as separate items, otherwise show the body panel
      if (child.state.repeatedPanels?.length) {
        for (const repeatedPanel of child.state.repeatedPanels) {
          const editableElement = getEditableElementFor(repeatedPanel)!;
          children.push({ sceneObject: repeatedPanel, editableElement, depth });
        }

        return;
      }
    }

    collectEditableElementChildren(child, children, depth + 1);
  });

  return children;
}
