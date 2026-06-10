import { css, cx, keyframes } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Icon, Stack, Text, useStyles2, useTheme2 } from '@grafana/ui';

import { FOOTER_HEIGHT, QueryEditorType } from '../../../constants';
import { trackSelectButtonClick } from '../../../tracking';
import {
  useAlertingContext,
  usePanelContext,
  useQueryEditorUIContext,
  useQueryRunnerContext,
} from '../../QueryEditorContext';
import { useDelayedUnmount } from '../../hooks/useDelayedUnmount';
import { BulkActionsBar, getBulkActionsVisibility } from '../BulkActionsBar';

export function SidebarFooter() {
  const { queries } = useQueryRunnerContext();
  const { transformations } = usePanelContext();
  const { alertRules } = useAlertingContext();
  const { cardType, setMultiSelectMode, selectedQueryRefIds, selectedTransformationIds, multiSelectMode } =
    useQueryEditorUIContext();
  const theme = useTheme2();
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

  // Render the bar OR the counts — never both. Keeping both in the DOM at
  // once would leave the obscured count Stack (incl. the Select… button) in
  // tab order and screen-reader output, even though the overlay covers it.
  const { shouldRender } = getBulkActionsVisibility({
    selectedQueryCount: selectedQueryRefIds.length,
    selectedTransformationCount: selectedTransformationIds.length,
    multiSelectMode,
  });
  const hasBulkActions = !isAlertView && shouldRender;

  // Layered swap: counts is the steady "background" view; the bar slides in
  // over it from the right and slides out the same way. The counts itself
  // never animates — it just sits there and gets covered or revealed.
  //   * Open : counts stays mounted for `exitMs` (the bar's enter duration)
  //            so it remains visible underneath while the bar slides in,
  //            then unmounts once the bar has fully covered it.
  //   * Close: counts mounts immediately and the bar plays its exit slide on
  //            top of it; the bar then unmounts and the counts is revealed.
  // The bar is z-indexed above the counts so the layering is independent of
  // DOM order in this file.
  const exitMs = theme.transitions.duration.short;
  const shouldRenderBar = useDelayedUnmount(hasBulkActions, exitMs);
  const shouldRenderCounts = useDelayedUnmount(!hasBulkActions, exitMs);

  const handleSelectClick = () => {
    setMultiSelectMode(true);
    trackSelectButtonClick();
  };

  // `inert` blocks focus from the covered view's buttons during the 250ms
  // transition (React 18 needs the object-spread workaround).
  const barIsExiting = !hasBulkActions;
  const countsIsCovered = hasBulkActions;

  return (
    <div className={styles.footer}>
      {shouldRenderCounts && (
        <div
          className={cx(styles.viewSlot, styles.countsLayout)}
          aria-hidden={countsIsCovered}
          {...(countsIsCovered && { inert: '' })}
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
      )}
      {shouldRenderBar && (
        <div
          className={cx(styles.viewSlot, styles.barOverlay, hasBulkActions ? styles.barEnter : styles.barExit)}
          aria-hidden={barIsExiting}
          {...(barIsExiting && { inert: '' })}
        >
          <BulkActionsBar />
        </div>
      )}
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
    // Opaque background + explicit stacking so the bar fully obscures the
    // counts beneath it regardless of JSX order in this file.
    barOverlay: css({
      background: theme.colors.background.primary,
      zIndex: 1,
    }),
    // Pure-translate cover/reveal of the counts by the bar. No opacity, so the
    // covered content never bleeds through.
    barEnter: css({
      [theme.transitions.handleMotion('no-preference')]: {
        animation: `${keyframes({ from: { transform: 'translateX(120%)' }, to: { transform: 'translateX(0)' } })} ${theme.transitions.duration.short}ms ${theme.transitions.easing.easeOut} both`,
      },
    }),
    barExit: css({
      [theme.transitions.handleMotion('no-preference')]: {
        animation: `${keyframes({ from: { transform: 'translateX(0)' }, to: { transform: 'translateX(120%)' } })} ${theme.transitions.duration.short}ms ${theme.transitions.easing.easeIn} both`,
      },
    }),
  };
}
