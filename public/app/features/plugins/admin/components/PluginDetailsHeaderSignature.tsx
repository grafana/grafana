import React from 'react';
import { GrafanaTheme2, PluginSignatureStatus } from '@grafana/data';
import { PluginSignatureBadge, useStyles2 } from '@grafana/ui';
import { PluginSignatureDetailsBadge } from './PluginSignatureDetailsBadge';
import { CatalogPlugin } from '../types';
import { PluginErrorBadge } from './Badges';
import { css } from '@emotion/css';

type Props = {
  plugin: CatalogPlugin;
};

// Designed to show plugin signature information in the header on the plugin's details page
export function PluginDetailsHeaderSignature({ plugin }: Props): React.ReactElement {
  const styles = useStyles2(getStyles);
  const isSignatureValid = plugin.signature === PluginSignatureStatus.valid;
  const isBroken = !!plugin.error;

  return (
    <div>
      <a href="https://grafana.com/docs/grafana/latest/plugins/plugin-signatures/" target="_blank" rel="noreferrer">
        <PluginSignatureBadge status={plugin.signature} />
      </a>

      {isSignatureValid && (
        <PluginSignatureDetailsBadge signatureType={plugin.signatureType} signatureOrg={plugin.signatureOrg} />
      )}

      {isBroken && (
        <div className={styles.error}>
          <PluginErrorBadge error={plugin.error!} />
        </div>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  error: css`
    display: inline-block;
    margin-left: ${theme.spacing()};
  `,
});
