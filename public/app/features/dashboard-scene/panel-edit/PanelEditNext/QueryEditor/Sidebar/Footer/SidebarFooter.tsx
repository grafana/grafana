import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Icon, Stack, Text, useStyles2 } from '@grafana/ui';

import { FOOTER_HEIGHT, QueryEditorType } from '../../../constants';
import { trackSelectButtonClick } from '../../../tracking';
import {
  useAlertingContext,
  usePanelContext,
  useQueryEditorUIContext,
  useQueryRunnerContext,
} from '../../QueryEditorContext';
import { BulkActionsBar, getBulkActionsVisibility } from '../BulkActionsBar';

export function SidebarFooter() {
  const { queries } = useQueryRunnerContext();
  const { transformations } = usePanelContext();
  const { alertRules } = useAlertingContext();
  const { cardType, setMultiSelectMode, selectedQueryRefIds, selectedTransformationIds, multiSelectMode } =
    useQueryEditorUIContext();
  const styles = useStyles2(getStyles);

  const isAlertView = cardType === QueryEditorType.Alert;
  const total = isAlertView ? alertRules.length : queries.length + transformations.length;
  const hidden = isAlertView
    ? 0
    : queries.filter((q) => q.hide).length + transformations.filter((t) => t.transformConfig.disabled).length;
  const visible = total - hidden;

  const suffixText = isAlertView
    ? t('query-editor-next.sidebar.footer-items-alert', '', {
        count: total,
        defaultValue_one: '{{count}} alerts',
        defaultValue_other: '{{count}} alerts',
      })
    : t('query-editor-next.sidebar.footer-items', '', {
        count: total,
        defaultValue_one: '{{count}} items',
        defaultValue_other: '{{count}} items',
      });

  // Both views are always rendered into the same grid cell; the bar slides over
  // the steady counts and back. `inert` + `aria-hidden` keep the hidden view out
  // of tab order and the accessibility tree (React 18 needs the object-spread).
  const { shouldRender } = getBulkActionsVisibility({
    selectedQueryCount: selectedQueryRefIds.length,
    selectedTransformationCount: selectedTransformationIds.length,
    multiSelectMode,
  });
  const hasBulkActions = !isAlertView && shouldRender;

  const handleSelectClick = () => {
    setMultiSelectMode(true);
    trackSelectButtonClick();
  };

  return (
    <div className={styles.footer}>
      <div
        className={cx(styles.viewSlot, styles.countsLayout)}
        aria-hidden={hasBulkActions}
        {...(hasBulkActions && { inert: '' })}
      >
        <Stack direction="row" alignItems="center" gap={0.5}>
          <Text weight="medium" variant="bodySmall">
            {suffixText}
          </Text>
          {!isAlertView && (
            <Button
              fill="text"
              size="sm"
              variant="secondary"
              icon="checkbox-multiple"
              onClick={handleSelectClick}
              aria-label={t('query-editor-next.sidebar.footer-select-label', 'Select multiple items')}
            >
              {t('query-editor-next.sidebar.footer-select', 'Select...')}
            </Button>
          )}
        </Stack>
        {!isAlertView && (
          <Stack direction="row" alignItems="center" gap={1}>
            <Stack direction="row" alignItems="center" gap={0.5}>
              <Icon name="eye" size="sm" className={styles.icon} />
              <Text weight="medium" variant="bodySmall">
                {visible}
              </Text>
            </Stack>
            <Stack direction="row" alignItems="center" gap={0.5}>
              <Icon name="eye-slash" size="sm" className={styles.icon} />
              <Text weight="medium" variant="bodySmall">
                {hidden}
              </Text>
            </Stack>
          </Stack>
        )}
      </div>
      <div
        className={cx(styles.viewSlot, styles.barOverlay, hasBulkActions && styles.barOpen)}
        aria-hidden={!hasBulkActions}
        {...(!hasBulkActions && { inert: '' })}
      >
        <BulkActionsBar />
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    // Single-cell grid: both views (bar + counts) drop into the same area so
    // the bar can slide on top of the static counts during the swap.
    // `overflow: hidden` clips the bar's off-screen start/end positions so
    // it can never peek past the rounded footer corners.
    footer: css({
      marginTop: 'auto',
      background: theme.colors.background.primary,
      padding: theme.spacing(0, 1.5),
      height: FOOTER_HEIGHT,
      display: 'grid',
      gridTemplateAreas: '"view"',
      overflow: 'hidden',
      borderRadius: `0 0 ${theme.shape.radius.default} ${theme.shape.radius.default}`,
      borderTop: `1px solid ${theme.colors.border.weak}`,
    }),
    icon: css({
      color: theme.colors.text.secondary,
    }),
    viewSlot: css({
      gridArea: 'view',
      display: 'flex',
      alignItems: 'center',
    }),
    countsLayout: css({
      justifyContent: 'space-between',
    }),
    // Opaque background + explicit stacking so the bar fully obscures the counts
    // beneath it. Parked off-screen by default; `barOpen` slides it over. No
    // opacity, so the covered content never bleeds through. Asymmetric easing is
    // free: CSS uses the transition on the target state (easeIn back to closed,
    // easeOut from `barOpen`).
    barOverlay: css({
      background: theme.colors.background.primary,
      zIndex: 1,
      transform: 'translateX(120%)',
      [theme.transitions.handleMotion('no-preference')]: {
        transition: theme.transitions.create('transform', {
          duration: theme.transitions.duration.short,
          easing: theme.transitions.easing.easeIn,
        }),
      },
    }),
    barOpen: css({
      transform: 'translateX(0)',
      [theme.transitions.handleMotion('no-preference')]: {
        transition: theme.transitions.create('transform', {
          duration: theme.transitions.duration.short,
          easing: theme.transitions.easing.easeOut,
        }),
      },
    }),
  };
}
