import { css, cx } from '@emotion/css';
import { sortBy } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, useTranslate } from '@grafana/i18n';
import { SceneObject } from '@grafana/scenes';
import { Box, Icon, Text, useElementSelection, useStyles2 } from '@grafana/ui';

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
    <Box padding={1} gap={0} display="flex" direction="column" element="ul" role="tree" position="relative">
      <DashboardOutlineNode sceneObject={dashboard} editPane={editPane} depth={0} />
    </Box>
  );
}

interface DashboardOutlineNodeProps {
  sceneObject: SceneObject;
  editPane: DashboardEditPane;
  depth: number;
}

function DashboardOutlineNode({ sceneObject, editPane, depth }: DashboardOutlineNodeProps) {
  const styles = useStyles2(getStyles);
  const { key } = sceneObject.useState();
  const [isCollapsed, setIsCollapsed] = useState(depth > 0);
  const { isSelected, onSelect } = useElementSelection(key);
  const isCloned = useMemo(() => isInCloneChain(key!), [key]);
  const editableElement = useMemo(() => getEditableElementFor(sceneObject)!, [sceneObject]);
  const { t } = useTranslate();
  const noTitleText = t('dashboard.outline.tree-item.no-title', '<no title>');

  const children = sortBy(collectEditableElementChildren(sceneObject, [], 0), 'depth');
  const elementInfo = editableElement.getEditableElementInfo();
  const instanceName = elementInfo.instanceName === '' ? noTitleText : elementInfo.instanceName;
  const elementCollapsed = editableElement.getCollapsedState?.();
  const outlineRename = useOutlineRename(editableElement);

  const onNodeClicked = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Only select via clicking outline never deselect
    if (!isSelected) {
      onSelect?.(e);
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
    if (elementCollapsed === !isCollapsed) {
      setIsCollapsed(elementCollapsed);
    }
  }, [isCollapsed, elementCollapsed]);

  return (
    // todo: add proper keyboard navigation
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events
    <li
      role="treeitem"
      aria-selected={isSelected}
      className={styles.container}
      onClick={onNodeClicked}
      style={{ '--depth': depth } as React.CSSProperties}
    >
      <div className={cx(styles.row, { [styles.rowSelected]: isSelected })}>
        <div className={styles.indentation}></div>
        {elementInfo.isContainer && (
          <button
            className={styles.angleButton}
            onClick={onToggleCollapse}
            data-testid={selectors.components.PanelEditor.Outline.node(instanceName)}
          >
            <Icon name={isCollapsed ? 'angle-right' : 'angle-down'} />
          </button>
        )}
        <button
          className={cx(styles.nodeName, { [styles.nodeNameClone]: isCloned })}
          onDoubleClick={outlineRename.onNameDoubleClicked}
          data-testid={selectors.components.PanelEditor.Outline.item(instanceName)}
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
        <ul className={styles.nodeChildren} role="group">
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
            <Text color="secondary" element="li">
              <Trans i18nKey="dashboard.outline.tree-item.empty">(empty)</Trans>
            </Text>
          )}
        </ul>
      )}
    </li>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      gap: theme.spacing(0.5),
      flexGrow: 1,
      flexDirection: 'column',
      borderRadius: theme.shape.radius.default,
      color: theme.colors.text.secondary,
    }),
    containerSelected: css({
      outline: `1px dashed ${theme.colors.primary.border} !important`,
      outlineOffset: '0px',
      color: theme.colors.text.primary,
    }),
    row: css({
      display: 'flex',
      gap: theme.spacing(0.5),
      borderRadius: theme.shape.radius.default,

      '&:hover': {
        color: theme.colors.text.primary,
        outline: `1px dashed ${theme.colors.border.strong}`,
        backgroundColor: theme.colors.emphasize(theme.colors.background.primary, 0.05),
      },
    }),
    rowSelected: css({
      color: theme.colors.text.primary,
      outline: `1px dashed ${theme.colors.primary.border} !important`,
      backgroundColor: theme.colors.emphasize(theme.colors.background.primary, 0.05),
    }),
    indentation: css({
      marginLeft: `calc(var(--depth) * ${theme.spacing(3)})`,
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
