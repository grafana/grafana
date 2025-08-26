import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Components } from '@grafana/e2e-selectors';
import { ScopesContextValue } from '@grafana/runtime';
import { Stack, useStyles2 } from '@grafana/ui';
import { ScopesSelector } from 'app/features/scopes/selector/ScopesSelector';

import { NavToolbarSeparator } from '../NavToolbar/NavToolbarSeparator';

import { getChromeHeaderLevelHeight } from './useChromeHeaderHeight';

export interface Props {
  actions?: React.ReactNode;
  breadcrumbActions?: React.ReactNode;
  scopes?: ScopesContextValue | undefined;
}

export function SingleTopBarActions({ actions, breadcrumbActions, scopes }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div data-testid={Components.NavToolbar.container} className={styles.actionsBar}>
      <Stack alignItems="center" justifyContent="flex-start" flex={1} wrap="nowrap" minWidth={0}>
        {scopes?.state.enabled ? <ScopesSelector /> : undefined}
        <Stack alignItems="center" justifyContent={'flex-end'} flex={1} wrap="nowrap" minWidth={0}>
          {breadcrumbActions}
          {breadcrumbActions && actions && <NavToolbarSeparator />}
          {actions}
        </Stack>
      </Stack>
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
      height: getChromeHeaderLevelHeight(),
      padding: theme.spacing(0, 1, 0, 2),
    }),
  };
};
