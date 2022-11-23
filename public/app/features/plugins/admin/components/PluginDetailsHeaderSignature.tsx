import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, PluginSignatureStatus } from '@grafana/data';
import { PluginSignatureBadge, useStyles2 } from '@grafana/ui';

import { CatalogPlugin } from '../types';

import { PluginSignatureDetailsBadge } from './PluginSignatureDetailsBadge';

type Props = {
  plugin: CatalogPlugin;
};

// Designed to show plugin signature information in the header on the plugin's details page
export function PluginDetailsHeaderSignature({ plugin }: Props): React.ReactElement {
  const styles = useStyles2(getStyles);
  const isSignatureValid = plugin.signature === PluginSignatureStatus.valid;

  return (
    <div className={styles.container}>
      <a
        href="https://grafana.com/docs/grafana/latest/plugins/plugin-signatures/"
        target="_blank"
        rel="noreferrer"
        className={styles.link}
      >
        <PluginSignatureBadge status={plugin.signature} />
      </a>

      {isSignatureValid && (
        <PluginSignatureDetailsBadge signatureType={plugin.signatureType} signatureOrg={plugin.signatureOrg} />
      )}
    </div>
  );
}

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      display: flex;
      flex-wrap: wrap;
      gap: ${theme.spacing(0.5)};
    `,
    link: css`
      display: inline-flex;
      align-items: center;
    `,
  };
};
