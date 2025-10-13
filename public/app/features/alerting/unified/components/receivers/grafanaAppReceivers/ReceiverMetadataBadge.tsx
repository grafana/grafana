import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, LinkButton, Stack, Tooltip, useStyles2 } from '@grafana/ui';

import { ReceiverPluginMetadata } from './useReceiversMetadata';

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
        <LinkButton icon="external-link-alt" href={externalUrl} target="_blank" variant="secondary" size="sm" />
      )}
    </Stack>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  warnIcon: css({
    fill: theme.colors.warning.text,
  }),
});
