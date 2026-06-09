import { css, keyframes } from '@emotion/css';
import { useBooleanFlagValue } from '@openfeature/react-sdk';

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
  const isMultiSelectEnabled = useBooleanFlagValue('queryEditorNextMultiSelect', false);
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

  const handleSelectClick = () => {
    setMultiSelectMode(true);
    trackSelectButtonClick();
  };

  return (
    <div className={styles.footer}>
      {hasBulkActions ? (
        <BulkActionsBar className={styles.bulkActionsBar} />
      ) : (
        <>
          <Stack direction="row" alignItems="center" gap={0.5}>
            <Text weight="medium" variant="bodySmall">
              {suffixText}
            </Text>
            {!isAlertView && isMultiSelectEnabled && (
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
        </>
      )}
    </div>
  );
}

// Keep the keyframes outside getStyles so the same animation name is reused across renders.
const slideInFromRight = keyframes({
  from: { transform: 'translateX(8px)', opacity: 0 },
  to: { transform: 'translateX(0)', opacity: 1 },
});

function getStyles(theme: GrafanaTheme2) {
  return {
    footer: css({
      marginTop: 'auto',
      background: theme.colors.background.primary,
      padding: theme.spacing(0, 1.5),
      height: FOOTER_HEIGHT,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: `0 0 ${theme.shape.radius.default} ${theme.shape.radius.default}`,
      borderTop: `1px solid ${theme.colors.border.weak}`,
    }),
    icon: css({
      color: theme.colors.text.secondary,
    }),
    bulkActionsBar: css({
      [theme.transitions.handleMotion('no-preference')]: {
        animation: `${slideInFromRight} ${theme.transitions.duration.short}ms ${theme.transitions.easing.easeOut} both`,
      },
    }),
  };
}
