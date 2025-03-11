import { css } from '@emotion/css';
import { PropsWithChildren } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Components } from '@grafana/e2e-selectors';
import { useScopes } from '@grafana/runtime';
import { Stack, useStyles2 } from '@grafana/ui';
import { ScopesSelector } from 'app/features/scopes/selector/ScopesSelector';

import { TOP_BAR_LEVEL_HEIGHT } from '../types';

export function SingleTopBarActions({ children }: PropsWithChildren) {
  const styles = useStyles2(getStyles);
  const scopes = useScopes();

  const scopesRender = scopes?.state.enabled ? <ScopesSelector /> : undefined;
  const childrenRender = children ? (
    <Stack
      alignItems="center"
      justifyContent={scopes?.state.enabled ? 'space-between' : 'flex-end'}
      flex={1}
      wrap="nowrap"
      minWidth={0}
    >
      {children}
    </Stack>
  ) : undefined;

  return (
    <div data-testid={Components.NavToolbar.container} className={styles.actionsBar}>
      {scopesRender ? (
        <Stack alignItems="center" justifyContent="flex-start" flex={1} wrap="nowrap" minWidth={0}>
          {scopesRender}
          {children}
        </Stack>
      ) : (
        childrenRender
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    actionsBar: css({
      alignItems: 'center',
      backgroundColor: theme.colors.background.primary,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      display: 'flex',
      height: TOP_BAR_LEVEL_HEIGHT,
      padding: theme.spacing(0, 1, 0, 2),
    }),
  };
};
