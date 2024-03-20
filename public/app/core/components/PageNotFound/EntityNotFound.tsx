import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { TextLink, useStyles2 } from '@grafana/ui';
import { EmptySearchState } from '@grafana/ui/src/components/EmptyState/EmptySearchState/EmptySearchState';

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
      <EmptySearchState message={`${entity} not found`}>
        We&apos;re looking but can&apos;t seem to find this {entity.toLowerCase()}. Try returning{' '}
        <TextLink href="/">home</TextLink> or seeking help on the{' '}
        <TextLink href="https://community.grafana.com" external>
          community site.
        </TextLink>
      </EmptySearchState>
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
