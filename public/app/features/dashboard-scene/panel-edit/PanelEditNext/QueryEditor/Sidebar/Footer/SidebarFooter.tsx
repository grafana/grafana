import { css } from '@emotion/css';
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

export function SidebarFooter() {
  const { queries } = useQueryRunnerContext();
  const { transformations } = usePanelContext();
  const { alertRules } = useAlertingContext();
  const { cardType, setMultiSelectMode } = useQueryEditorUIContext();
  const isMultiSelectEnabled = useBooleanFlagValue('queryEditorNextMultiSelect', false);
  const styles = useStyles2(getStyles);

  const isAlertView = cardType === QueryEditorType.Alert;
  const total = isAlertView ? alertRules.length : queries.length + transformations.length;
  const hidden = isAlertView
    ? 0
    : queries.filter((q) => q.hide).length + transformations.filter((t) => t.transformConfig.disabled).length;
  const visible = total - hidden;

  const suffixText = isAlertView
    ? t('query-editor-next.sidebar.footer-items-alert', '{{count}} alerts', { count: total })
    : t('query-editor-next.sidebar.footer-items', '{{count}} items', { count: total });

  const handleSelectClick = () => {
    setMultiSelectMode(true);
    trackSelectButtonClick();
  };

  return (
    <div className={styles.footer}>
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
    </div>
  );
}

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
  };
}
