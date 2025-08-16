import { css, cx } from '@emotion/css';
import { Draggable } from '@hello-pangea/dnd';
import { useCallback, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { SceneComponentProps } from '@grafana/scenes';
import { clearButtonStyles, Icon, Tooltip, useElementSelection, usePointerDistance, useStyles2 } from '@grafana/ui';

import { useIsConditionallyHidden } from '../../conditional-rendering/useIsConditionallyHidden';
import { useIsClone } from '../../utils/clone';
import { useDashboardState, useInterpolatedTitle } from '../../utils/utils';
import { DashboardScene } from '../DashboardScene';

import { RowItem } from './RowItem';

export function RowItemRenderer({ model }: SceneComponentProps<RowItem>) {
  const { layout, collapse: isCollapsed, fillScreen, hideHeader: isHeaderHidden, isDropTarget, key } = model.useState();
  const isClone = useIsClone(model);
  const { isEditing } = useDashboardState(model);
  const [isConditionallyHidden, conditionalRenderingClass, conditionalRenderingOverlay] =
    useIsConditionallyHidden(model);
  const { isSelected, onSelect, isSelectable } = useElementSelection(key);
  const title = useInterpolatedTitle(model);
  const styles = useStyles2(getStyles);
  const clearStyles = useStyles2(clearButtonStyles);
  const isTopLevel = model.parent?.parent instanceof DashboardScene;
  const pointerDistance = usePointerDistance();

  const myIndex = model
    .getParentLayout()
    .getRowsWithRepeats()
    .findIndex((row) => row === model);

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
            !isCollapsed && styles.wrapperNotCollapsed,
            dragSnapshot.isDragging && styles.dragging,
            isCollapsed && styles.wrapperCollapsed,
            shouldGrow && styles.wrapperGrow,
            conditionalRenderingClass,
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
          data-testid={selectors.components.DashboardRow.wrapper(title!)}
          {...dragProvided.draggableProps}
        >
          {(!isHeaderHidden || isEditing) && (
            <div
              className={cx(styles.rowHeader, 'dashboard-row-header')}
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
                >
                  {!model.hasUniqueTitle() && (
                    <Tooltip
                      content={t('dashboard.rows-layout.row-warning.title-not-unique', 'This title is not unique')}
                    >
                      <Icon name="exclamation-triangle" />
                    </Tooltip>
                  )}
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
              {isDraggable && <Icon name="draggabledots" className="dashboard-row-header-drag-handle" />}
            </div>
          )}
          {!isCollapsed && <layout.Component model={layout} />}
          {conditionalRenderingOverlay}
        </div>
      )}
    </Draggable>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    rowHeader: css({
      display: 'flex',
      gap: theme.spacing(1),
      padding: theme.spacing(0.5, 0.5, 0.5, 0),
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing(1),

      '& .dashboard-row-header-drag-handle': css({
        opacity: 0,

        [theme.transitions.handleMotion('no-preference', 'reduce')]: {
          transition: 'opacity 0.25s',
        },
      }),

      '&:hover': css({
        '& .dashboard-row-header-drag-handle': css({
          opacity: 1,
        }),
      }),
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
      ...theme.typography.h5,
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
      opacity: 0.6,

      '&:hover': css({
        opacity: 1,
      }),
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
      // Without this min height, the custom grid (SceneGridLayout) wont render
      // should be 1px more than row header + padding + margin
      // consist of lineHeight + paddingBlock + margin + 0.125 = 39px
      minHeight: theme.spacing(2.75 + 1 + 1 + 0.125),
    }),
    wrapperNotCollapsed: css({
      '> div:nth-child(2)': {
        marginLeft: theme.spacing(3),
        position: 'relative',
        width: 'auto',

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
