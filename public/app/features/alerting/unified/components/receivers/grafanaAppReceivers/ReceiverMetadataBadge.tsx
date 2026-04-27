import { css } from '@emotion/css';

import type { GrafanaTheme2 } from '@grafana/data/themes';
import { t } from '@grafana/i18n';
import { LinkButton, Stack, Tooltip } from '@grafana/ui';
import { Icon } from '@grafana/ui/components/icons';
import { useStyles2 } from '@grafana/ui/themes';

import { type ReceiverPluginMetadata } from './useReceiversMetadata';

interface Props {
  metadata: ReceiverPluginMetadata;
}

export const ReceiverMetadataBadge = ({ metadata: { icon, title, externalUrl, warning } }: Props) => {
  const styles = useStyles2(getStyles);

  return (
    <Stack alignItems="center" gap={0.5}>
      <Stack direction="row" alignItems="center" gap={0.5}>
        {warning ? (
          <Tooltip content={warning} theme="error">
            <Icon name="exclamation-triangle" className={styles.warnIcon} />
          </Tooltip>
        ) : (
          <img src={icon} alt={title} height="16px" />
        )}
        <span>{title}</span>
      </Stack>
      {externalUrl && (
        <LinkButton
          aria-label={t('alerting.receiver-metadata-badge.aria-label-open-external-link', 'Open external link')}
          icon="external-link-alt"
          href={externalUrl}
          target="_blank"
          variant="secondary"
          size="sm"
        />
      )}
    </Stack>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  warnIcon: css({
    fill: theme.colors.warning.text,
  }),
});
