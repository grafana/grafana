import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { GrotNotFound } from '../GrotNotFound/GrotNotFound';

export interface Props {
  /**
   * Defaults to Page
   */
  entity?: string;
}

export function EntityNotFound({ entity = 'Page' }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <h1>{entity} not found</h1>
      <div className={styles.subtitle}>
        We&apos;re looking but can&apos;t seem to find this {entity.toLowerCase()}. Try returning{' '}
        <a href="/" className="external-link">
          home
        </a>{' '}
        or seeking help on the{' '}
        <a href="https://community.grafana.com" target="_blank" rel="noreferrer" className="external-link">
          community site.
        </a>
      </div>
      <div className={styles.grot}>
        <GrotNotFound show404={entity === 'Page'} />
      </div>
    </div>
  );
}

export function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(8, 2, 2, 2),
      h1: {
        textAlign: 'center',
      },
    }),
    subtitle: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.h5.fontSize,
      padding: theme.spacing(2, 0),
      textAlign: 'center',
    }),
    grot: css({
      alignSelf: 'center',
      maxWidth: '450px',
      paddingTop: theme.spacing(8),
      width: '100%',
    }),
  };
}
