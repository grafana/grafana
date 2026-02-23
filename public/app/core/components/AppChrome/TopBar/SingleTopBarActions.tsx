import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Components } from '@grafana/e2e-selectors';
import { ScopesContextValue } from '@grafana/runtime';
import { Stack, useStyles2 } from '@grafana/ui';
import { ScopesSelector } from 'app/features/scopes/selector/ScopesSelector';

import { useExtensionSidebarContext } from '../ExtensionSidebar/ExtensionSidebarProvider';
import { NavToolbarSeparator } from '../NavToolbar/NavToolbarSeparator';

import { getChromeHeaderLevelHeight } from './useChromeHeaderHeight';

export interface Props {
  actions?: React.ReactNode;
  breadcrumbActions?: React.ReactNode;
  scopes?: ScopesContextValue | undefined;
}

export function SingleTopBarActions({ actions, breadcrumbActions, scopes }: Props) {
  const { isOpen: isExtensionSidebarOpen, extensionSidebarWidth } = useExtensionSidebarContext();
  const styles = useStyles2(getStyles, extensionSidebarWidth);

  return (
    <div
      data-testid={Components.NavToolbar.container}
      className={cx(styles.actionsBar, isExtensionSidebarOpen && styles.constrained)}
    >
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

const getStyles = (theme: GrafanaTheme2, extensionSidebarWidth = 0) => {
  return {
    actionsBar: css({
      alignItems: 'center',
      backgroundColor: theme.colors.background.primary,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      display: 'flex',
      height: getChromeHeaderLevelHeight(),
      padding: theme.spacing(0, 1, 0, 2),
    }),
    constrained: css({
      maxWidth: `calc(100% - ${extensionSidebarWidth}px)`,
    }),
  };
};
