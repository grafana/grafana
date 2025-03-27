import { css, cx } from '@emotion/css';
import { useCallback, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { SceneComponentProps } from '@grafana/scenes';
import { clearButtonStyles, Icon, Tooltip, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { useIsClone } from '../../utils/clone';
import {
  useDashboardState,
  useElementSelectionScene,
  useInterpolatedTitle,
  useIsConditionallyHidden,
} from '../../utils/utils';

import { RowItem } from './RowItem';
import { RowItemMenu } from './RowItemMenu';

export function RowItemRenderer({ model }: SceneComponentProps<RowItem>) {
  const { layout, collapse: isCollapsed, fillScreen, hideHeader: isHeaderHidden, isDropTarget } = model.useState();
  const isClone = useIsClone(model);
  const { isEditing } = useDashboardState(model);
  const isConditionallyHidden = useIsConditionallyHidden(model);
  const { isSelected, onSelect, isSelectable } = useElementSelectionScene(model);
  const title = useInterpolatedTitle(model);
  const styles = useStyles2(getStyles);
  const clearStyles = useStyles2(clearButtonStyles);

  const shouldGrow = !isCollapsed && fillScreen;
  const isHidden = isConditionallyHidden && !isEditing;

  // Highlight the full row when hovering over header
  const [selectableHighlight, setSelectableHighlight] = useState(false);
  const onHeaderEnter = useCallback(() => setSelectableHighlight(true), []);
  const onHeaderLeave = useCallback(() => setSelectableHighlight(false), []);

  if (isHidden) {
    return null;
  }

  return (
    <div
      ref={model.containerRef}
      data-dashboard-drop-target-key={model.state.key}
      className={cx(
        styles.wrapper,
        isEditing && !isCollapsed && styles.wrapperEditing,
        isEditing && isCollapsed && styles.wrapperEditingCollapsed,
        isCollapsed && styles.wrapperCollapsed,
        shouldGrow && styles.wrapperGrow,
        isConditionallyHidden && 'dashboard-visible-hidden-element',
        !isClone && isSelected && 'dashboard-selected-element',
        !isClone && !isSelected && selectableHighlight && 'dashboard-selectable-element',
        isDropTarget && 'dashboard-drop-target'
      )}
      onPointerDown={(e) => {
        // If we selected and are clicking a button inside row header then don't de-select row
        if (isSelected && e.target instanceof Element && e.target.closest('button')) {
          // Stop propagation otherwise dashboaed level onPointerDown will de-select row
          e.stopPropagation();
          return;
        }

        onSelect?.(e);
      }}
    >
      {(!isHeaderHidden || isEditing) && (
        <div
          className={cx(isHeaderHidden && 'dashboard-visible-hidden-element', styles.rowHeader, 'dashboard-row-header')}
          onMouseEnter={isSelectable ? onHeaderEnter : undefined}
          onMouseLeave={isSelectable ? onHeaderLeave : undefined}
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
            <span className={cx(styles.rowTitle, isHeaderHidden && styles.rowTitleHidden)} role="heading">
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
          {!isClone && isEditing && <RowItemMenu model={model} />}
        </div>
      )}
      {!isCollapsed && <layout.Component model={layout} />}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    rowHeader: css({
      width: '100%',
      display: 'flex',
      gap: theme.spacing(1),
      padding: theme.spacing(0.5),
      alignItems: 'center',
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
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      minHeight: '100px',
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
