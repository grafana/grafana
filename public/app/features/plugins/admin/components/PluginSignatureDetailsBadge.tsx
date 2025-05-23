import { css } from '@emotion/css';
import { capitalize } from 'lodash';
import * as React from 'react';

import { GrafanaTheme2, PluginSignatureType } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { useStyles2, Icon, Badge, IconName } from '@grafana/ui';

const SIGNATURE_ICONS: Record<string, IconName> = {
  [PluginSignatureType.grafana]: 'grafana',
  [PluginSignatureType.commercial]: 'shield',
  [PluginSignatureType.community]: 'shield',
  DEFAULT: 'shield-exclamation',
};

type Props = {
  signatureType?: PluginSignatureType;
  signatureOrg?: string;
};

// Shows more information about a valid signature
export function PluginSignatureDetailsBadge({ signatureType, signatureOrg = '' }: Props): React.ReactElement | null {
  const styles = useStyles2(getStyles);

  if (!signatureType && !signatureOrg) {
    return null;
  }

  const signatureTypeText = signatureType === PluginSignatureType.grafana ? 'Grafana Labs' : capitalize(signatureType);
  const signatureIcon = SIGNATURE_ICONS[signatureType || ''] || SIGNATURE_ICONS.DEFAULT;

  return (
    <>
      <DetailsBadge>
        <div className={styles.detailsWrapper}>
          <strong className={styles.strong}>Level:&nbsp;</strong>
          <Icon size="xs" name={signatureIcon} />
          &nbsp;
          {signatureTypeText}
        </div>
      </DetailsBadge>

      <DetailsBadge>
        <strong className={styles.strong}>
          <Trans i18nKey="plugins.plugin-signature-details-badge.signed-by" values={{ signatureOrg }}>
            Signed by: {{ signatureOrg }}
          </Trans>
        </strong>
      </DetailsBadge>
    </>
  );
}

export const DetailsBadge = ({ children }: React.PropsWithChildren<{}>) => {
  const styles = useStyles2(getStyles);

  return <Badge color="green" className={styles.badge} text={children} />;
};

const getStyles = (theme: GrafanaTheme2) => ({
  badge: css({
    backgroundColor: theme.colors.background.canvas,
    borderColor: theme.colors.border.strong,
    color: theme.colors.text.secondary,
    whiteSpace: 'nowrap',
  }),
  detailsWrapper: css({
    alignItems: 'center',
    display: 'flex',
  }),
  strong: css({
    color: theme.colors.text.primary,
  }),
  icon: css({
    marginRight: theme.spacing(0.5),
  }),
});
