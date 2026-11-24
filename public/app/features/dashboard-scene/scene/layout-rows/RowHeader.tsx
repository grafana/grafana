import { css, cx } from '@emotion/css';
import { type DraggableProvided } from '@hello-pangea/dnd';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { clearButtonStyles, ClipboardButton, Icon, Tooltip, useElementSelection, useStyles2 } from '@grafana/ui';
import { ReportProse } from 'app/core/components/ReportProse/ReportProse';
import { REPORT_SERIF_STACK } from 'app/core/components/ReportProse/styles';
import { dashVar } from 'app/core/dashboardStyle/cssVars';

import { toggleRowCollapse } from '../../actions/layout/toggleRowCollapse';
import { useDashboardState, useInterpolatedTitle } from '../../utils/utils';
import { DashboardScene } from '../DashboardScene';
import { SectionEditActionsWrapper } from '../edit-actions-popover/SectionEditActions';
import { LayoutModeIndicator } from '../layouts-shared/LayoutModeIndicator';
import { mapIdToGridLayoutType } from '../layouts-shared/utils';
import { isFullDashboardEditing } from '../types/dashboard';

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
  const { layout, hideHeader: isHeaderHidden, headerStyle, summary, key } = model.useState();
  const isReport = headerStyle === 'report';
  const dashboardState = useDashboardState(model);
  const isEditing = isFullDashboardEditing(dashboardState);
  const { planning } = dashboardState;
  const { isSelectable, onClear: onClearSelection } = useElementSelection(key);
  const title = useInterpolatedTitle(model);
  const styles = useStyles2(getStyles);
  const clearStyles = useStyles2(clearButtonStyles);
  const isTopLevel = model.parent?.parent instanceof DashboardScene;
  const reportDepth = isReport ? model.getReportSectionDepth() : 0;
  const layoutType = mapIdToGridLayoutType(layout.descriptor.id);

  const titleElement = (
    <span
      className={cx(
        styles.rowTitle,
        isReport && styles.reportTitle,
        isHeaderHidden && styles.rowTitleHidden,
        !isTopLevel && !isReport && styles.rowTitleNested,
        isReport && reportDepth > 0 && styles.reportTitleNested,
        isCollapsed && !isReport && styles.rowTitleCollapsed
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

  const collapseIcon = (
    <Icon name={isCollapsed ? 'angle-right' : 'angle-down'} className={cx(isReport && styles.reportChevron)} />
  );
  const collapseButton = (
    <button
      onClick={(evt) => {
        if (isEditing) {
          toggleRowCollapse(model);
        } else {
          model.onCollapseToggle();
        }
        onClearSelection?.();
      }}
      className={cx(clearStyles, styles.rowTitleButton, isReport && styles.reportTitleButton)}
      aria-expanded={!isCollapsed}
      aria-controls={contentId}
      aria-label={
        // A report heading in view mode names itself through the title inside the button.
        isReport && !isEditing
          ? undefined
          : isCollapsed
            ? t('dashboard.rows-layout.row.expand', 'Expand row {{title}}', { title })
            : t('dashboard.rows-layout.row.collapse', 'Collapse row {{title}}', { title })
      }
      data-testid={selectors.components.DashboardRow.toggle(title)}
    >
      {/* Report headings lead with the title so it lines up with the prose and panels below. */}
      {!isReport && collapseIcon}
      {!isEditing && titleElement}
      {isReport && collapseIcon}
    </button>
  );
  const ReportHeading = REPORT_HEADING_TAGS[Math.min(reportDepth, REPORT_HEADING_TAGS.length - 1)];

  return (
    <>
      <SectionEditActionsWrapper kind="row" item={model} disabled={isDragging}>
        <div
          className={cx(styles.rowHeader, isReport && styles.reportHeader, 'dashboard-row-header')}
          onMouseEnter={isSelectable ? onHeaderEnter : undefined}
          onMouseLeave={isSelectable ? onHeaderLeave : undefined}
          data-dashboard-element-key={key}
          data-dashboard-element-type="row"
          {...dragHandleProps}
        >
          {isReport ? (
            <ReportHeading className={styles.reportHeading}>
              {isEditing && titleElement}
              {collapseButton}
            </ReportHeading>
          ) : (
            <>
              {collapseButton}
              {isEditing && titleElement}
            </>
          )}
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
      </SectionEditActionsWrapper>
      {isReport && <ReportSummary summary={summary} isEditing={isEditing} isHeaderHidden={isHeaderHidden} />}
    </>
  );
}

/** Indexed by nesting depth; the dashboard title is the page's h1, so the outermost section is an h2. */
const REPORT_HEADING_TAGS = ['h2', 'h3', 'h4', 'h5', 'h6'] as const;

interface ReportSummaryProps {
  summary: string | undefined;
  isEditing: boolean;
  isHeaderHidden: boolean | undefined;
}

function ReportSummary({ summary, isEditing, isHeaderHidden }: ReportSummaryProps) {
  const styles = useStyles2(getStyles);

  if (!summary?.trim()) {
    return isEditing ? (
      <p className={cx(styles.reportSummary, styles.reportSummaryPlaceholder)}>
        <Trans i18nKey="dashboard.rows-layout.report.summary-placeholder">
          Add a summary in the row options to tell readers what this section establishes.
        </Trans>
      </p>
    ) : null;
  }

  return (
    <ReportProse
      markdown={summary}
      className={cx(styles.reportSummary, isHeaderHidden && styles.reportSummaryHidden)}
      data-testid={selectors.components.DashboardRow.reportSummary}
    />
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
    reportHeader: css({
      alignItems: 'flex-start',
      marginBottom: theme.spacing(0.5),
      padding: 0,
    }),
    reportHeading: css({
      display: 'flex',
      alignItems: 'baseline',
      gap: theme.spacing(0.5),
      minWidth: 0,
      margin: 0,
      // Typography lives on the title span; the element only carries the semantics.
      font: 'inherit',
    }),
    reportTitleButton: css({
      alignItems: 'baseline',
      textAlign: 'left',
      gap: theme.spacing(0.75),
      padding: 0,
      color: 'inherit',
      '&:hover .report-chevron, &:focus-visible .report-chevron': {
        color: theme.colors.text.primary,
      },
    }),
    reportTitle: cx(
      'dashboard-report-title',
      css({
        fontFamily: dashVar('fontDisplay', REPORT_SERIF_STACK),
        fontSize: 'var(--dash-heading-size, 1.75rem)',
        lineHeight: 1.15,
        fontWeight: dashVar('headingWeight', '600'),
        letterSpacing: dashVar('headingTracking', '-0.01em'),
        color: dashVar('ink', theme.colors.text.primary),
        whiteSpace: 'normal',
        textWrap: 'balance',
        overflow: 'visible',
        gap: theme.spacing(1),
        display: 'inline',
      })
    ),
    reportTitleNested: css({
      fontSize: 'calc(var(--dash-heading-size, 1.75rem) * 0.72)',
    }),
    reportChevron: cx(
      'report-chevron',
      css({
        flexShrink: 0,
        color: theme.colors.text.secondary,
        alignSelf: 'center',
        [theme.transitions.handleMotion('no-preference', 'reduce')]: {
          transition: 'color 0.2s',
        },
      })
    ),
    reportSummary: cx(
      'dashboard-emphasis',
      css({
        margin: theme.spacing(0, 0, 2),
        fontFamily: dashVar('fontBody', REPORT_SERIF_STACK),
        color: dashVar('ink', theme.colors.text.primary),
      })
    ),
    reportSummaryHidden: css({
      opacity: 0.6,
    }),
    reportSummaryPlaceholder: css({
      fontFamily: dashVar('fontBody', REPORT_SERIF_STACK),
      fontStyle: 'italic',
      fontSize: '1.0625rem',
      color: theme.colors.text.disabled,
    }),
  };
}
