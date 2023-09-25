import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { HorizontalGroup, Icon, LinkButton, Tooltip, useStyles2 } from '@grafana/ui';

import { ReceiverMetadata } from './useReceiversMetadata';

interface Props {
  metadata: ReceiverMetadata;
}

export const ReceiverMetadataBadge = ({ metadata: { icon, title, externalUrl, warning } }: Props) => {
  const styles = useStyles2(getStyles);

  return (
    <Stack alignItems="center" gap={1}>
      <div className={styles.wrapper}>
        <HorizontalGroup align="center" spacing="xs">
          <img src={icon} alt="" height="12px" />
          <span>{title}</span>
        </HorizontalGroup>
      </div>
      {externalUrl && <LinkButton icon="external-link-alt" href={externalUrl} variant="secondary" size="sm" />}
      {warning && (
        <Tooltip content={warning} theme="error">
          <Icon name="exclamation-triangle" size="lg" className={styles.warnIcon} />
        </Tooltip>
      )}
    </Stack>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    text-align: left;
    height: 22px;
    display: inline-flex;
    padding: 1px 4px;
    border-radius: ${theme.shape.borderRadius()};
    border: 1px solid rgba(245, 95, 62, 1);
    color: rgba(245, 95, 62, 1);
    font-weight: ${theme.typography.fontWeightRegular};
  `,
  warnIcon: css`
    fill: ${theme.colors.warning.main};
  `,
});
