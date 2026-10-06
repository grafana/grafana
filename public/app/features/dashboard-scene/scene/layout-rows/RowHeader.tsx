import { css, cx } from '@emotion/css';
import { type DraggableProvided } from '@hello-pangea/dnd';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { clearButtonStyles, ClipboardButton, Icon, Tooltip, useElementSelection, useStyles2 } from '@grafana/ui';

import { useDashboardState, useInterpolatedTitle } from '../../utils/utils';
import { DashboardScene } from '../DashboardScene';
import { RowEditActionsWrapper } from '../edit-actions-popover/RowEditActions';
import { LayoutModeIndicator } from '../layouts-shared/LayoutModeIndicator';
import { mapIdToGridLayoutType } from '../layouts-shared/utils';

import { type RowItem } from './RowItem';

interface Props {
  model: RowItem;
  isDragging: boolean;
  dragHandleProps: DraggableProvided['dragHandleProps'];
  isDraggable: boolean;
  isCollapsed: boolean;
  contentId: string;
  onHeaderEnter: () => void;
  onHeaderLeave: () => void;
}

export function RowHeader({
  model,
  isDragging,
  dragHandleProps,
  isDraggable,
  isCollapsed,
  contentId,
  onHeaderEnter,
  onHeaderLeave,
}: Props) {
  const { layout, hideHeader: isHeaderHidden, key } = model.useState();
  const { isEditing, planning } = useDashboardState(model);
  const { isSelectable, onClear: onClearSelection } = useElementSelection(key);
  const title = useInterpolatedTitle(model);
  const styles = useStyles2(getStyles);
  const clearStyles = useStyles2(clearButtonStyles);
  const isTopLevel = model.parent?.parent instanceof DashboardScene;
  const layoutType = mapIdToGridLayoutType(layout.descriptor.id);

  const titleElement = (
    <span
      className={cx(
        styles.rowTitle,
        isHeaderHidden && styles.rowTitleHidden,
        !isTopLevel && styles.rowTitleNested,
        isCollapsed && styles.rowTitleCollapsed
      )}
      data-testid={selectors.components.DashboardRow.title(title)}
    >
      {!model.hasUniqueTitle() && (
        <Tooltip content={t('dashboard.rows-layout.row-warning.title-not-unique', 'This title is not unique')}>
          <Icon name="exclamation-triangle" />
        </Tooltip>
      )}
      {title}
      {isHeaderHidden && (
        <Tooltip content={t('dashboard.rows-layout.header-hidden-tooltip', 'Row header only visible in edit mode')}>
          <Icon name="eye-slash" />
        </Tooltip>
      )}
    </span>
  );

  return (
    <RowEditActionsWrapper row={model} disabled={isDragging}>
      <div
        className={cx(styles.rowHeader, 'dashboard-row-header')}
        onMouseEnter={isSelectable ? onHeaderEnter : undefined}
        onMouseLeave={isSelectable ? onHeaderLeave : undefined}
        data-dashboard-element-key={key}
        data-dashboard-element-type="row"
        {...dragHandleProps}
      >
        <button
          onClick={(evt) => {
            model.onCollapseToggle();
            onClearSelection?.();
          }}
          className={cx(clearStyles, styles.rowTitleButton)}
          aria-expanded={!isCollapsed}
          aria-controls={contentId}
          aria-label={
            isCollapsed
              ? t('dashboard.rows-layout.row.expand', 'Expand row {{title}}', { title })
              : t('dashboard.rows-layout.row.collapse', 'Collapse row {{title}}', { title })
          }
          data-testid={selectors.components.DashboardRow.toggle(title)}
        >
          <Icon name={isCollapsed ? 'angle-right' : 'angle-down'} />
          {!isEditing && titleElement}
        </button>
        {isEditing && titleElement}
        {!isEditing && !planning && (
          <ClipboardButton
            icon="link"
            size="sm"
            fill="text"
            variant="secondary"
            className={cx(styles.copyLinkButton, 'dashboard-row-header-copy-link')}
            aria-label={t('dashboard.rows-layout.row.copy-link', 'Copy link to row')}
            tooltip={t('dashboard.rows-layout.row.copy-link', 'Copy link to row')}
            getText={() => model.getUrl()}
          />
        )}
        {isEditing && layoutType && <LayoutModeIndicator layoutType={layoutType} className="layout-indicator" />}
        {isDraggable && <Icon name="draggabledots" className="dashboard-row-header-drag-handle" />}
      </div>
    </RowEditActionsWrapper>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    rowHeader: css({
      display: 'flex',
      gap: theme.spacing(1),
      padding: theme.spacing(0.5, 0.5, 0.5, 0),
      alignItems: 'center',
      justifyContent: 'flex-start',
      marginBottom: theme.spacing(1),

      '& .dashboard-row-header-drag-handle': css({
        opacity: 0,
        // Keep the drag handle at the far right now that the header is left-aligned.
        marginLeft: 'auto',

        [theme.transitions.handleMotion('no-preference', 'reduce')]: {
          transition: 'opacity 0.25s',
        },
      }),
      '& .layout-indicator': css({
        display: 'none',
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
    copyLinkButton: css({
      opacity: 0,

      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: 'opacity 0.25s',
      },

      '&:focus-visible': {
        opacity: 1,
      },
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
      flexGrow: 0,
      flexShrink: 1,
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
  };
}
