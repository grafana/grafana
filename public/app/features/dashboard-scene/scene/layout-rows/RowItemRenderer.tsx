import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { SceneComponentProps } from '@grafana/scenes';
import { Button, Icon, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { useIsClone } from '../../utils/clone';
import {
  useDashboardState,
  useElementSelectionScene,
  useInterpolatedTitle,
  useIsConditionallyHidden,
} from '../../utils/utils';

import { RowItem } from './RowItem';

export function RowItemRenderer({ model }: SceneComponentProps<RowItem>) {
  const { layout, isCollapsed, height = 'expand', isHeaderHidden } = model.useState();
  const isClone = useIsClone(model);
  const { isEditing, showHiddenElements } = useDashboardState(model);
  const isConditionallyHidden = useIsConditionallyHidden(model);
  const { isSelected, onSelect } = useElementSelectionScene(model);
  const title = useInterpolatedTitle(model);
  const styles = useStyles2(getStyles);

  if (isConditionallyHidden && !showHiddenElements) {
    return null;
  }

  const shouldGrow = !isCollapsed && height === 'expand';
  const isHiddenButVisibleElement = showHiddenElements && isConditionallyHidden;
  const isHiddenButVisibleHeader = showHiddenElements && isHeaderHidden;

  return (
    <div
      className={cx(
        styles.wrapper,
        isCollapsed && styles.wrapperCollapsed,
        shouldGrow && styles.wrapperGrow,
        isHiddenButVisibleElement && 'dashboard-visible-hidden-element',
        !isClone && isSelected && 'dashboard-selected-element'
      )}
    >
      {(!isHeaderHidden || showHiddenElements) && (
        <div className={cx(isHiddenButVisibleHeader && 'dashboard-visible-hidden-element', styles.rowHeader)}>
          <button
            onClick={() => model.onCollapseToggle()}
            className={styles.rowTitleButton}
            aria-label={
              isCollapsed
                ? t('dashboard.rows-layout.row.expand', 'Expand row')
                : t('dashboard.rows-layout.row.collapse', 'Collapse row')
            }
            data-testid={selectors.components.DashboardRow.title(title!)}
          >
            <Icon name={isCollapsed ? 'angle-right' : 'angle-down'} />
            <span className={styles.rowTitle} role="heading">
              {title}
            </span>
          </button>
          {!isClone && isEditing && (
            <Button icon="pen" variant="secondary" size="sm" fill="text" onPointerDown={onSelect} />
          )}
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

      '&:hover, &:focus-within': {
        '& > div': {
          opacity: 1,
        },
      },

      '& > div': {
        marginBottom: 0,
        marginRight: theme.spacing(1),
      },
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
  };
}
