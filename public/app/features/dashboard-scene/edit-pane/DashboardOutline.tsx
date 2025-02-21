import { css, cx } from '@emotion/css';
import { useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneObject, VizPanel } from '@grafana/scenes';
import { Box, Icon, IconButton, Stack, useElementSelection, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { isEditableDashboardElement } from '../scene/types/EditableDashboardElement';
import { isInCloneChain } from '../utils/clone';
import { getDashboardSceneFor } from '../utils/utils';

import { DashboardEditPane } from './DashboardEditPane';
import { getEditableElementFor } from './shared';

export interface Props {
  editPane: DashboardEditPane;
}

export function DashboardOutline({ editPane }: Props) {
  const dashboard = getDashboardSceneFor(editPane);

  return (
    <Box padding={1} gap={0.5} display="flex" direction={'column'}>
      <DashboardOutlineNode sceneObject={dashboard} />
    </Box>
  );
}

function DashboardOutlineNode({ sceneObject }: { sceneObject: SceneObject }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const { key } = sceneObject.useState();
  const styles = useStyles2(getStyles);

  const editableElement = useMemo(() => {
    return getEditableElementFor(sceneObject)!;
  }, [sceneObject]);

  const children = collectEditableElementChildren(sceneObject);

  const hasChildren = children.length > 0;
  const isCloned = useMemo(() => isInCloneChain(key!), [key]);
  const elementInfo = editableElement.getEditableElementInfo();
  const { isSelected, onSelect } = useElementSelection(key);

  return (
    <>
      <Stack
        direction="row"
        gap={0.5}
        alignItems="center"
        role="presentation"
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-owns={hasChildren ? key : undefined}
      >
        {hasChildren && (
          <IconButton
            name={isExpanded ? 'angle-down' : 'angle-right'}
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={
              isExpanded
                ? t('dashboard.outline.tree.item.collapse', 'Collapse item')
                : t('dashboard.outline.tree.item.expand', 'Expand item')
            }
          />
        )}
        <button
          role="treeitem"
          className={cx(styles.nodeButton, isCloned && styles.nodeButtonClone, isSelected && styles.nodeButtonSelected)}
          onPointerDown={(evt) => onSelect?.(evt)}
        >
          <span>{elementInfo.name}</span>
          <Icon name={elementInfo.icon} />
        </button>
      </Stack>
      {hasChildren && isExpanded && (
        <div className={styles.container} role="group">
          {children.map((child) => (
            <DashboardOutlineNode key={child.state.key} sceneObject={child} />
          ))}
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
      gap: theme.spacing(1),
      marginLeft: theme.spacing(1),
      paddingLeft: theme.spacing(1.5),
      borderLeft: `1px solid ${theme.colors.border.medium}`,
    }),
    nodeButton: css({
      boxShadow: 'none',
      border: 'none',
      background: 'transparent',
      padding: theme.spacing(0.25, 1),
      borderRadius: theme.shape.radius.default,
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      overflow: 'hidden',
      '&:hover': {
        backgroundColor: theme.colors.action.hover,
      },
      '> span': {
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      },
    }),
    nodeButtonSelected: css({
      color: theme.colors.primary.text,
    }),
    nodeButtonClone: css({
      color: theme.colors.text.secondary,
      cursor: 'not-allowed',
    }),
  };
}

function collectEditableElementChildren(sceneObject: SceneObject, children: SceneObject[] = []) {
  sceneObject.forEachChild((child) => {
    if (isEditableDashboardElement(child)) {
      children.push(child);
    } else if (child instanceof VizPanel) {
      children.push(child);
    } else {
      collectEditableElementChildren(child, children);
    }
  });

  return children;
}
