import { css, cx } from '@emotion/css';
import React, { useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { type SceneComponentProps, sceneGraph, SceneObjectBase, type SceneObject } from '@grafana/scenes';
import { Box, Icon, ScrollContainer, Sidebar, Text, Tooltip, useElementSelection, useStyles2 } from '@grafana/ui';

import { DashboardLinksSet } from '../settings/links/DashboardLinksSet';
import { LinkEdit } from '../settings/links/LinkAddEditableElement';
import { DashboardFiltersSet } from '../settings/variables/DashboardFiltersSet';
import { SectionFiltersSet } from '../settings/variables/SectionFiltersSet';
import { isRepeatCloneOrChildOf } from '../utils/clone';
import { DashboardInteractions } from '../utils/interactions';
import { getDashboardSceneFor } from '../utils/utils';

import { DashboardEditPane } from './DashboardEditPane';
import { getEditableElementFor } from './shared';
import { useOutlineRename } from './useOutlineRename';

export class DashboardOutline extends SceneObjectBase {
  public static Component = DashboardOutlineRenderer;
  public getId() {
    return 'outline' as const;
  }
}

export function DashboardOutlineRenderer({ model }: SceneComponentProps<DashboardOutline>) {
  const editPane = sceneGraph.getAncestor(model, DashboardEditPane)!;
  const dashboard = getDashboardSceneFor(model);
  const { isEditing } = dashboard.useState();

  return (
    <Box display="flex" direction="column" flex={1} height="100%">
      <Sidebar.PaneHeader
        title={t('dashboard.outline.pane-header', 'Content outline')}
        onGoBack={editPane.getOnGetBackCallback()}
      />
      <ScrollContainer showScrollIndicators={true}>
        <Box padding={1} gap={0} display="flex" direction="column" element="ul" role="tree" position="relative">
          <DashboardOutlineNode sceneObject={dashboard} isEditing={isEditing} editPane={editPane} depth={0} index={0} />
        </Box>
      </ScrollContainer>
    </Box>
  );
}

interface DashboardOutlineNodeProps {
  sceneObject: SceneObject;
  editPane: DashboardEditPane;
  isEditing: boolean | undefined;
  depth: number;
  index: number;
}

function DashboardOutlineNode({ sceneObject, editPane, isEditing, depth, index }: DashboardOutlineNodeProps) {
  const styles = useStyles2(getStyles);
  const key = sceneObject.state.key;
  const [isCollapsed, setIsCollapsed] = useState(depth > 0);
  const { isSelected, onSelect } = useElementSelection(key);
  const isCloned = useMemo(() => isRepeatCloneOrChildOf(sceneObject), [sceneObject]);
  const editableElement = useMemo(() => getEditableElementFor(sceneObject)!, [sceneObject]);

  const noTitleText = t('dashboard.outline.tree-item.no-title', '<no title>');

  const elementInfo = editableElement.getEditableElementInfo();
  const instanceName = elementInfo.instanceName === '' ? noTitleText : elementInfo.instanceName;
  const outlineRename = useOutlineRename(editableElement, isEditing);
  const isContainer = editableElement.getOutlineChildren ? true : false;
  const outlineChildren = editableElement.getOutlineChildren?.(isEditing) ?? [];
  const visibleChildren = isEditing
    ? outlineChildren
    : outlineChildren.filter((child) => !getEditableElementFor(child)?.getEditableElementInfo().isHidden);

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
    setIsCollapsed(!isCollapsed);
  };

  if (elementInfo.isHidden && !isEditing) {
    return null;
  }

  return (
    // todo: add proper keyboard navigation
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events
    <li
      role="treeitem"
      aria-selected={isSelected}
      className={styles.container}
      onClick={onNodeClicked}
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      style={{ '--depth': depth } as React.CSSProperties}
    >
      <div
        className={cx(styles.row, isEditing ? styles.rowEditMode : styles.rowViewMode, {
          [styles.rowSelected]: isSelected,
        })}
      >
        <div className={styles.indentation}></div>
        {isContainer && (
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
              <div className={styles.nodeName}>
                {elementInfo.tooltip ? (
                  <Tooltip content={elementInfo.tooltip} placement="left">
                    <span className={styles.nodeNameText}>
                      <Text truncate>{instanceName}</Text>
                    </span>
                  </Tooltip>
                ) : (
                  <Text truncate>{instanceName}</Text>
                )}
                {elementInfo.isHidden && <Icon name="eye-slash" size="sm" className={styles.hiddenIcon} />}
              </div>
              {isCloned && (
                <span>
                  <Trans i18nKey="dashboard.outline.repeated-item">Repeat</Trans>
                </span>
              )}
            </>
          )}
        </button>
      </div>

      {isContainer && !isCollapsed && (
        <ul className={styles.nodeChildren} role="group">
          {visibleChildren.length > 0 ? (
            visibleChildren.map((child, i) => (
              <DashboardOutlineNode
                key={child.state.key}
                sceneObject={child}
                editPane={editPane}
                depth={depth + 1}
                isEditing={isEditing}
                index={i}
              />
            ))
          ) : (
            <li
              role="treeitem"
              aria-selected={isSelected}
              className={styles.container}
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
    nodeName: css({
      display: 'flex',
      gap: theme.spacing(0.5),
      flexGrow: 1,
      alignItems: 'center',
      overflow: 'hidden',
    }),
    nodeNameText: css({
      display: 'inline-flex',
      alignItems: 'center',
      overflow: 'hidden',
      minWidth: 0,
    }),
    hiddenIcon: css({
      color: theme.colors.text.secondary,
      marginLeft: theme.spacing(1),
    }),
    nodeButtonClone: css({
      color: theme.colors.text.secondary,
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
