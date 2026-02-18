import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, Stack, Text, useStyles2 } from '@grafana/ui';

import { QUERY_EDITOR_COLORS, QueryEditorType } from '../../constants';
import {
  useAlertingContext,
  usePanelContext,
  useQueryEditorUIContext,
  useQueryRunnerContext,
} from '../QueryEditorContext';

export function SidebarFooter() {
  const { queries } = useQueryRunnerContext();
  const { transformations } = usePanelContext();
  const { alertRules } = useAlertingContext();
  const { cardType } = useQueryEditorUIContext();
  const styles = useStyles2(getStyles);

  const isAlertView = cardType === QueryEditorType.Alert;
  const total = isAlertView ? alertRules.length : queries.length + transformations.length;
  const hidden = isAlertView
    ? 0
    : queries.filter((q) => q.hide).length + transformations.filter((t) => t.transformConfig.disabled).length;
  const visible = total - hidden;

  return (
    <div className={styles.footer}>
      <Text weight="medium" variant="bodySmall">
        {t('query-editor-next.sidebar.footer-items', '{{count}} items', { count: total })}
      </Text>
      {!isAlertView && (
        <Stack direction="row" alignItems="center" gap={2}>
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
      background: QUERY_EDITOR_COLORS.sidebarFooterBackground,
      padding: theme.spacing(1, 1.5),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: `0 0 ${theme.shape.radius.default} ${theme.shape.radius.default}`,
    }),
    icon: css({
      color: theme.colors.text.secondary,
    }),
  };
}
