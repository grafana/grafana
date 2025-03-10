import { css, cx } from '@emotion/css';
import { useMemo, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { SceneComponentProps, sceneGraph } from '@grafana/scenes';
import { Checkbox, clearButtonStyles, Icon, useElementSelection, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { isClonedKey } from '../../utils/clone';
import { getDashboardSceneFor } from '../../utils/utils';

import { RowItem } from './RowItem';
import { RowItemMenu } from './RowItemMenu';

export function RowItemRenderer({ model }: SceneComponentProps<RowItem>) {
  const { layout, title, isCollapsed, height = 'min', isHeaderHidden, key } = model.useState();
  const isClone = useMemo(() => isClonedKey(key!), [key]);
  const dashboard = getDashboardSceneFor(model);
  const { isEditing, showHiddenElements } = dashboard.useState();
  const styles = useStyles2(getStyles);
  const clearStyles = useStyles2(clearButtonStyles);
  const titleInterpolated = sceneGraph.interpolate(model, title, undefined, 'text');
  const ref = useRef<HTMLDivElement>(null);
  const shouldGrow = !isCollapsed && height === 'expand';
  const { isSelected, onSelect } = useElementSelection(key);

  return (
    <div
      className={cx(
        styles.wrapper,
        isCollapsed && styles.wrapperCollapsed,
        shouldGrow && styles.wrapperGrow,
        !isClone && isSelected && 'dashboard-selected-element'
      )}
      ref={ref}
    >
      {(!isHeaderHidden || (isEditing && showHiddenElements)) && (
        <div className={styles.rowHeader}>
          {!isClone && isEditing && (
            <div className={styles.checkboxWrapper} onPointerDown={onSelect}>
              <Checkbox value={!!isSelected} />
            </div>
          )}
          <button
            onClick={() => model.onCollapseToggle()}
            className={cx(clearStyles, styles.rowTitleButton)}
            aria-label={
              isCollapsed
                ? t('dashboard.rows-layout.row.expand', 'Expand row')
                : t('dashboard.rows-layout.row.collapse', 'Collapse row')
            }
            data-testid={selectors.components.DashboardRow.title(titleInterpolated!)}
          >
            <Icon name={isCollapsed ? 'angle-right' : 'angle-down'} />
            <span className={styles.rowTitle} role="heading">
              {titleInterpolated}
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
      padding: theme.spacing(0, 0, 0.5, 0),
      margin: theme.spacing(0, 0, 1, 0),
      alignItems: 'center',
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
      fontSize: theme.typography.h5.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      maxWidth: '100%',
      flexGrow: 1,
      minWidth: 0,
    }),
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      minHeight: '100px',
    }),
    wrapperGrow: css({
      flexGrow: 1,
    }),
    wrapperCollapsed: css({
      flexGrow: 0,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      minHeight: 'unset',
    }),
    rowActions: css({
      display: 'flex',
      opacity: 0,
    }),
    checkboxWrapper: css({
      display: 'flex',
      alignItems: 'center',
    }),
  };
}
