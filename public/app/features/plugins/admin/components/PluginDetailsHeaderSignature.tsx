import { css } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { PluginSignatureBadge, useStyles2 } from '@grafana/ui';

import { CatalogPlugin } from '../types';

type Props = {
  plugin: CatalogPlugin;
};

// Designed to show plugin signature information in the header on the plugin's details page
export function PluginDetailsHeaderSignature({ plugin }: Props): React.ReactElement {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <a
        href="https://grafana.com/docs/grafana/latest/plugins/plugin-signatures/"
        target="_blank"
        rel="noreferrer"
        className={styles.link}
      >
        <PluginSignatureBadge
          status={plugin.signature}
          signatureType={plugin.signatureType}
          signatureOrg={plugin.signatureOrg}
        />
      </a>
    </div>
  );
}

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(0.5),
    }),
    link: css({
      display: 'inline-flex',
      alignItems: 'center',
    }),
  };
};
