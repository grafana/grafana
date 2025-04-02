import { css, cx } from '@emotion/css';
import { Draggable } from '@hello-pangea/dnd';
import { useCallback, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { SceneComponentProps } from '@grafana/scenes';
import { clearButtonStyles, Icon, Tooltip, useElementSelection, usePointerDistance, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { useIsClone } from '../../utils/clone';
import { useDashboardState, useInterpolatedTitle, useIsConditionallyHidden } from '../../utils/utils';
import { DashboardScene } from '../DashboardScene';

import { RowItem } from './RowItem';

export function RowItemRenderer({ model }: SceneComponentProps<RowItem>) {
  const { layout, collapse: isCollapsed, fillScreen, hideHeader: isHeaderHidden, isDropTarget, key } = model.useState();
  const isClone = useIsClone(model);
  const { isEditing } = useDashboardState(model);
  const isConditionallyHidden = useIsConditionallyHidden(model);
  const { isSelected, onSelect, isSelectable } = useElementSelection(key);
  const title = useInterpolatedTitle(model);
  const { rows } = model.getParentLayout().useState();
  const styles = useStyles2(getStyles);
  const clearStyles = useStyles2(clearButtonStyles);
  const isTopLevel = model.parent?.parent instanceof DashboardScene;
  const pointerDistance = usePointerDistance();

  const myIndex = rows.findIndex((row) => row === model);

  const shouldGrow = !isCollapsed && fillScreen;
  const isHidden = isConditionallyHidden && !isEditing;

  // Highlight the full row when hovering over header
  const [selectableHighlight, setSelectableHighlight] = useState(false);
  const onHeaderEnter = useCallback(() => setSelectableHighlight(true), []);
  const onHeaderLeave = useCallback(() => setSelectableHighlight(false), []);

  const isDraggable = !isClone && isEditing;

  if (isHidden) {
    return null;
  }

  return (
    <Draggable key={key!} draggableId={key!} index={myIndex} isDragDisabled={!isDraggable}>
      {(dragProvided, dragSnapshot) => (
        <div
          ref={(ref) => {
            dragProvided.innerRef(ref);
            model.containerRef.current = ref;
          }}
          data-dashboard-drop-target-key={model.state.key}
          className={cx(
            styles.wrapper,
            dragSnapshot.isDragging && styles.dragging,
            isEditing && !isCollapsed && styles.wrapperEditing,
            isEditing && isCollapsed && styles.wrapperEditingCollapsed,
            isCollapsed && styles.wrapperCollapsed,
            shouldGrow && styles.wrapperGrow,
            isConditionallyHidden && 'dashboard-visible-hidden-element',
            !isClone && isSelected && 'dashboard-selected-element',
            !isClone && !isSelected && selectableHighlight && 'dashboard-selectable-element',
            isDropTarget && 'dashboard-drop-target'
          )}
          onPointerDown={(evt) => {
            evt.stopPropagation();
            pointerDistance.set(evt);
          }}
          onPointerUp={(evt) => {
            // If we selected and are clicking a button inside row header then don't de-select row
            if (isSelected && evt.target instanceof Element && evt.target.closest('button')) {
              // Stop propagation otherwise dashboaed level onPointerDown will de-select row
              evt.stopPropagation();
              return;
            }

            if (pointerDistance.check(evt)) {
              return;
            }

            setTimeout(() => onSelect?.(evt));
          }}
          {...dragProvided.draggableProps}
        >
          {(!isHeaderHidden || isEditing) && (
            <div
              className={cx(
                isHeaderHidden && 'dashboard-visible-hidden-element',
                styles.rowHeader,
                'dashboard-row-header'
              )}
              onMouseEnter={isSelectable ? onHeaderEnter : undefined}
              onMouseLeave={isSelectable ? onHeaderLeave : undefined}
              {...dragProvided.dragHandleProps}
            >
              <button
                onClick={() => model.onCollapseToggle()}
                className={cx(clearStyles, styles.rowTitleButton)}
                aria-label={
                  isCollapsed
                    ? t('dashboard.rows-layout.row.expand', 'Expand row')
                    : t('dashboard.rows-layout.row.collapse', 'Collapse row')
                }
                data-testid={selectors.components.DashboardRow.title(title!)}
              >
                <Icon name={isCollapsed ? 'angle-right' : 'angle-down'} />
                <span
                  className={cx(
                    styles.rowTitle,
                    isHeaderHidden && styles.rowTitleHidden,
                    !isTopLevel && styles.rowTitleNested,
                    isCollapsed && styles.rowTitleCollapsed
                  )}
                  role="heading"
                >
                  {title}
                  {isHeaderHidden && (
                    <Tooltip
                      content={t('dashboard.rows-layout.header-hidden-tooltip', 'Row header only visible in edit mode')}
                    >
                      <Icon name="eye-slash" />
                    </Tooltip>
                  )}
                </span>
              </button>
              {isDraggable && <Icon name="draggabledots" />}
            </div>
          )}
          {!isCollapsed && <layout.Component model={layout} />}
        </div>
      )}
    </Draggable>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    rowHeader: css({
      width: '100%',
      display: 'flex',
      gap: theme.spacing(1),
      padding: theme.spacing(0.5, 0.5, 0.5, 0),
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing(1),
    }),
    rowTitleButton: css({
      display: 'flex',
      alignItems: 'center',
      cursor: 'pointer',
      background: 'transparent',
      border: 'none',
      minWidth: 0,
      gap: theme.spacing(1),
    }),
    rowTitle: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(2),
      fontSize: theme.typography.h5.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      maxWidth: '100%',
      flexGrow: 1,
      minWidth: 0,
    }),
    rowTitleHidden: css({
      textDecoration: 'line-through',
    }),
    rowTitleNested: css({
      fontSize: theme.typography.body.fontSize,
      fontWeight: theme.typography.fontWeightRegular,
    }),
    rowTitleCollapsed: css({
      color: theme.colors.text.secondary,
    }),
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      minHeight: '100px',
      '> div:nth-child(2)': {
        marginLeft: theme.spacing(3),
        position: 'relative',
        '&:before': {
          content: '""',
          position: 'absolute',
          top: `-8px`,
          bottom: 0,
          left: '-16px',
          width: '1px',
          backgroundColor: theme.colors.border.weak,
        },
      },
    }),
    dragging: css({
      cursor: 'move',
    }),
    wrapperEditing: css({
      padding: theme.spacing(0.5),

      '.dashboard-row-header': {
        padding: 0,
      },
    }),
    wrapperEditingCollapsed: css({
      padding: theme.spacing(0.5),

      '.dashboard-row-header': {
        marginBottom: theme.spacing(0),
        padding: 0,
      },
    }),
    wrapperGrow: css({
      flexGrow: 1,
    }),
    wrapperCollapsed: css({
      flexGrow: 0,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      minHeight: 'unset',

      '.dashboard-row-header': {
        marginBottom: theme.spacing(0),
      },
    }),
    rowActions: css({
      display: 'flex',
      opacity: 0,
    }),
    checkboxWrapper: css({
      display: 'flex',
      alignItems: 'center',
      paddingLeft: theme.spacing(1),
    }),
  };
}
