import { css, cx } from '@emotion/css';
import { sortBy } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneObject } from '@grafana/scenes';
import { Box, Icon, Stack, Text, useElementSelection, useStyles2 } from '@grafana/ui';
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
    <Box padding={1} gap={0.25} display="flex" direction="column">
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

  const onNameClicked = (evt: React.PointerEvent) => {
    // Only select via clicking outline never deselect
    if (!isSelected) {
      onSelect?.(evt);
    }

    editableElement.scrollIntoView?.();
  };

  const onToggleCollapse = () => {
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
      <Stack gap={0.5}>
        {elementInfo.isContainer && (
          <button role="treeitem" className={styles.angleButton} onClick={onToggleCollapse}>
            <Icon name={!isCollapsed ? 'angle-down' : 'angle-right'} />
          </button>
        )}
        <button
          role="button"
          className={cx(styles.nodeButton, isCloned && styles.nodeButtonClone, isSelected && styles.nodeButtonSelected)}
          onPointerDown={onNameClicked}
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
      </Stack>

      {elementInfo.isContainer && !isCollapsed && (
        <div className={styles.container} role="group">
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
      flexDirection: 'column',
      gap: theme.spacing(0.5),
      marginLeft: theme.spacing(1),
      paddingLeft: theme.spacing(1.5),
      borderLeft: `1px solid ${theme.colors.border.medium}`,
    }),
    angleButton: css({
      boxShadow: 'none',
      border: 'none',
      background: 'transparent',
      borderRadius: theme.shape.radius.default,
      padding: 0,
      color: theme.colors.text.secondary,
      lineHeight: 0,
    }),
    nodeButton: css({
      boxShadow: 'none',
      border: 'none',
      background: 'transparent',
      padding: theme.spacing(0.25, 1, 0.25, 0),
      borderRadius: theme.shape.radius.default,
      color: theme.colors.text.secondary,
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      overflow: 'hidden',
      '&:hover': {
        color: theme.colors.text.primary,
        outline: `1px dashed ${theme.colors.border.strong}`,
        outlineOffset: '0px',
        backgroundColor: theme.colors.emphasize(theme.colors.background.canvas, 0.08),
      },
      '> span': {
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      },
    }),
    nodeButtonSelected: css({
      color: theme.colors.text.primary,
      outline: `1px dashed ${theme.colors.primary.border} !important`,
      outlineOffset: '0px',
      '&:hover': {
        outline: `1px dashed ${theme.colors.primary.border}`,
      },
    }),
    hiddenIcon: css({
      color: theme.colors.text.secondary,
      marginLeft: theme.spacing(1),
    }),
    nodeButtonClone: css({
      color: theme.colors.text.secondary,
      cursor: 'not-allowed',
    }),
    outlineInput: css({
      border: `1px solid ${theme.colors.primary.border}`,
      height: theme.spacing(3),

      '&:focus': {
        outline: 'none',
        boxShadow: 'none',
      },
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
