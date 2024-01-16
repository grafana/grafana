import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data/src/themes';
import { useStyles2 } from '@grafana/ui';

import { DataSourceInformation } from '../home/Insights';

export function DataSourcesInfo({ datasources }: { datasources: DataSourceInformation[] }) {
  const styles = useStyles2(getStyles);

  const displayDs = datasources.map((ds) => (
    <div key={ds.uid}>
      {ds.settings?.meta.info.logos.small && (
        <img className={styles.dsImage} src={ds.settings?.meta.info.logos.small} alt={ds.settings?.name || ds.uid} />
      )}
      <span>{ds.settings?.name || ds.uid}</span>
    </div>
  ));

  return <div className={styles.dsContainer}>{displayDs}</div>;
}

const getStyles = (theme: GrafanaTheme2) => ({
  dsImage: css({
    label: 'ds-image',
    width: '16px',
    marginRight: '3px',
  }),
  dsContainer: css({
    display: 'flex',
    flexDirection: 'row',
    fontSize: theme.typography.bodySmall.fontSize,
    gap: '10px',
    marginBottom: '10px',
    justifyContent: 'flex-end',
  }),
});
