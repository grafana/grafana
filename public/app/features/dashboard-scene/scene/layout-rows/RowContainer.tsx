import { css, cx } from '@emotion/css';
import { type DraggableProvided } from '@hello-pangea/dnd';
import { type ReactNode, useCallback, useId, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { useElementSelection, usePointerDistance, useStyles2 } from '@grafana/ui';

import { useDashboardState, useInterpolatedTitle } from '../../utils/utils';
import { SectionVariableControls } from '../VariableControls';
import { DASHBOARD_DROP_TARGET_KEY_ATTR } from '../types/DashboardDropTarget';
import { isDashboardLayoutGrid } from '../types/DashboardLayoutGrid';

import { RowHeader } from './RowHeader';
import { type RowItem } from './RowItem';

interface Props {
  model: RowItem;
  dragProvided: DraggableProvided;
  isDragging: boolean;
  isDraggable: boolean;
  conditionalRenderingClass: string | undefined;
  conditionalRenderingOverlay: ReactNode;
}

export function RowContainer({
  model,
  dragProvided,
  isDragging,
  isDraggable,
  conditionalRenderingClass,
  conditionalRenderingOverlay,
}: Props) {
  const {
    layout,
    collapse,
    fillScreen,
    hideHeader: isHeaderHidden,
    isDropTarget,
    key,
    repeatSourceKey,
  } = model.useState();
  const contentId = useId();
  const isCollapsed = Boolean(collapse) && !isHeaderHidden;
  const { isEditing } = useDashboardState(model);
  const { isSelected, onSelect } = useElementSelection(key);
  const { isSelected: isSourceSelected } = useElementSelection(repeatSourceKey);
  const title = useInterpolatedTitle(model);
  const styles = useStyles2(getStyles);
  const pointerDistance = usePointerDistance();
  const rowVariablesSet = model.state.$variables;
  const shouldGrow = !isCollapsed && fillScreen;
  const [selectableHighlight, setSelectableHighlight] = useState(false);
  const onHeaderEnter = useCallback(() => setSelectableHighlight(true), []);
  const onHeaderLeave = useCallback(() => setSelectableHighlight(false), []);

  return (
    <div
      ref={(ref) => {
        dragProvided.innerRef(ref);
        model.containerRef.current = ref;
      }}
      {...{ [DASHBOARD_DROP_TARGET_KEY_ATTR]: isDashboardLayoutGrid(layout) ? model.state.key : undefined }}
      className={cx(
        styles.wrapper,
        'dashboard-row-wrapper',
        !isCollapsed && styles.wrapperNotCollapsed,
        isDragging && styles.dragging,
        isCollapsed && styles.wrapperCollapsed,
        shouldGrow && styles.wrapperGrow,
        conditionalRenderingClass,
        !isSelected && !isSourceSelected && selectableHighlight && 'dashboard-selectable-element',
        (isSelected || isSourceSelected) && 'dashboard-selected-element',
        isDropTarget && 'dashboard-drop-target'
      )}
      onPointerDown={(evt) => {
        evt.stopPropagation();
        pointerDistance.set(evt);
      }}
      onPointerUp={(evt) => {
        // If we selected and are clicking a button inside row header then don't de-select row
        if (evt.target instanceof Element && evt.target.closest('button')) {
          // Stop propagation otherwise dashboard level onPointerDown will de-select row
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
        <RowHeader
          model={model}
          isDragging={isDragging}
          dragHandleProps={dragProvided.dragHandleProps}
          isDraggable={isDraggable}
          isCollapsed={isCollapsed}
          contentId={contentId}
          onHeaderEnter={onHeaderEnter}
          onHeaderLeave={onHeaderLeave}
        />
      )}
      {!isCollapsed && (
        <div className={styles.rowLayoutWrapper} id={contentId}>
          {rowVariablesSet && <SectionVariableControls variableSet={rowVariablesSet} />}
          <layout.Component model={layout} />
        </div>
      )}
      {conditionalRenderingOverlay}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      // Without this min height, the custom grid (SceneGridLayout) wont render
      // should be 1px more than row header + padding + margin
      // consist of lineHeight + paddingBlock + margin + 0.125 = 39px
      minHeight: theme.spacing(2.75 + 1 + 1 + 0.125),

      // Show grid controls when hovering anywhere on the row
      '&:hover .dashboard-canvas-controls': {
        opacity: 1,
      },
      // But hide controls inside nested rows (they'll show when that row is hovered)
      '&:hover .dashboard-row-wrapper .dashboard-canvas-controls': {
        opacity: 0,
      },
      // Re-enable for the specific nested row being hovered
      '&:hover .dashboard-row-wrapper:hover .dashboard-canvas-controls': {
        opacity: 1,
      },
      // Reveal this row's layout indicator when hovering or focusing anywhere on the row
      '&:hover > .dashboard-row-header .layout-indicator, &:focus-within > .dashboard-row-header .layout-indicator': {
        display: 'inline-block',
      },
      // Reveal this row's copy link button when hovering anywhere on the row
      // (child selector so hovering an outer row does not reveal nested rows' buttons)
      '&:hover > .dashboard-row-header .dashboard-row-header-copy-link': {
        opacity: 1,
      },
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
      backgroundColor: theme.colors.background.canvas,
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
    rowLayoutWrapper: css({
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      minHeight: 0,
      height: '100%',
    }),
  };
}
