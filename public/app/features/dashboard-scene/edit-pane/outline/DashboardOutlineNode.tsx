import { css, cx } from '@emotion/css';
import { useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { type SceneObject } from '@grafana/scenes';
import { Icon, Text, useElementSelection, useStyles2 } from '@grafana/ui';

import { isRepeatCloneOrChildOf } from '../../utils/clone';
import { DashboardInteractions } from '../../utils/interactions';
import { type DashboardEditPane } from '../DashboardEditPane';
import { getEditableElementFor } from '../shared';
import { useOutlineRename } from '../useOutlineRename';

import { type DashboardOutline } from './DashboardOutline';
import { DashboardOutlineNodeButtonContent } from './DashboardOutlineNodeButtonContent';
import { getCommonStyles } from './styles';
import { getOutlineInstanceName, getVisibleOutlineChildren, selectOutlineObject } from './utils';

interface DashboardOutlineNodeProps {
  sceneObject: SceneObject;
  editPane: DashboardEditPane;
  outline: DashboardOutline;
  isEditing: boolean | undefined;
  depth: number;
  index: number;
}

export function DashboardOutlineNode({
  sceneObject,
  editPane,
  outline,
  isEditing,
  depth,
  index,
}: DashboardOutlineNodeProps) {
  const commonStyles = useStyles2(getCommonStyles);
  const styles = useStyles2(getStyles);
  const key = sceneObject.state.key;
  const [isCollapsed, setIsCollapsed] = useState(() => outline.isNodeCollapsed(key, depth > 0));
  const { isSelected, onSelect } = useElementSelection(key);
  const isCloned = useMemo(() => isRepeatCloneOrChildOf(sceneObject), [sceneObject]);
  const editableElement = useMemo(() => getEditableElementFor(sceneObject)!, [sceneObject]);

  const noTitleText = t('dashboard.outline.tree-item.no-title', '<no title>');

  const elementInfo = editableElement.getEditableElementInfo();
  const instanceName = getOutlineInstanceName(elementInfo.instanceName, noTitleText);
  const outlineRename = useOutlineRename(editableElement, isEditing);
  const isContainer = editableElement.getOutlineChildren ? true : false;
  const visibleChildren = useMemo(
    () => getVisibleOutlineChildren(sceneObject, Boolean(isEditing)),
    [sceneObject, isEditing]
  );

  const onNodeClicked = (e: React.MouseEvent) => {
    e.stopPropagation();

    selectOutlineObject(sceneObject, editPane, isSelected ?? false, onSelect, e);

    editableElement.scrollIntoView?.();
    DashboardInteractions.outlineItemClicked({ index, depth, isEditing });
  };

  const onToggleCollapse = (evt: React.MouseEvent) => {
    evt.stopPropagation();
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    outline.setNodeCollapsed(key, newCollapsed);
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
      className={commonStyles.wrapper}
      onClick={onNodeClicked}
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      style={{ '--depth': depth } as React.CSSProperties}
    >
      <div
        className={cx(commonStyles.row, isEditing ? commonStyles.rowEditMode : commonStyles.rowViewMode, {
          [commonStyles.rowSelected]: isSelected,
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
          className={cx(commonStyles.nodeButton, { [commonStyles.nodeButtonClone]: isCloned })}
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

      {isContainer && !isCollapsed && (
        <ul className={styles.nodeChildren} role="group">
          {visibleChildren.length > 0 ? (
            visibleChildren.map((child, i) => (
              <DashboardOutlineNode
                key={child.state.key}
                sceneObject={child}
                editPane={editPane}
                outline={outline}
                depth={depth + 1}
                isEditing={isEditing}
                index={i}
              />
            ))
          ) : (
            <li
              role="treeitem"
              aria-selected={isSelected}
              className={commonStyles.wrapper}
              // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
              style={{ '--depth': depth + 1 } as React.CSSProperties}
            >
              <div className={commonStyles.row}>
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
