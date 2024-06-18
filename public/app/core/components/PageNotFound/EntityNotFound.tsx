import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { EmptyState, TextLink, useStyles2 } from '@grafana/ui';

export interface Props {
  /**
   * Defaults to Page
   */
  entity?: string;
}

export function EntityNotFound({ entity = 'Page' }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container} data-testid={selectors.components.EntityNotFound}>
      <EmptyState message={`${entity} not found`} variant="not-found">
        We&apos;re looking but can&apos;t seem to find this {entity.toLowerCase()}. Try returning{' '}
        <TextLink href="/">home</TextLink> or seeking help on the{' '}
        <TextLink href="https://community.grafana.com" external>
          community site.
        </TextLink>
      </EmptyState>
    </div>
  );
}

export function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      padding: theme.spacing(8, 2, 2, 2),
    }),
  };
}
