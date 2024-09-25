import { css } from '@emotion/css';
import { useMemo } from 'react';

import { AppPlugin, GrafanaTheme2, PluginContextProvider, UrlQueryMap } from '@grafana/data';
import { config } from '@grafana/runtime';
import { CellProps, Column, InteractiveTable, Stack, useStyles2 } from '@grafana/ui';

import { Changelog } from '../components/Changelog';
import { VersionList } from '../components/VersionList';
import { usePluginConfig } from '../hooks/usePluginConfig';
import { CatalogPlugin, Permission, PluginTabIds } from '../types';

import { AppConfigCtrlWrapper } from './AppConfigWrapper';
import { PluginDashboards } from './PluginDashboards';
import { PluginUsage } from './PluginUsage';

type Props = {
  plugin: CatalogPlugin;
  queryParams: UrlQueryMap;
  pageId: string;
};

type Cell<T extends keyof Permission = keyof Permission> = CellProps<Permission, Permission[T]>;

export function PluginDetailsBody({ plugin, queryParams, pageId }: Props): JSX.Element {
  const styles = useStyles2(getStyles);
  const { value: pluginConfig } = usePluginConfig(plugin);

  const columns: Array<Column<Permission>> = useMemo(
    () => [
      {
        id: 'action',
        header: 'Action',
        cell: ({ cell: { value } }: Cell<'action'>) => value,
      },
      {
        id: 'scope',
        header: 'Scope',
        cell: ({ cell: { value } }: Cell<'scope'>) => value,
      },
    ],
    []
  );

  if (pageId === PluginTabIds.OVERVIEW) {
    return (
      <div
        className={styles.readme}
        dangerouslySetInnerHTML={{
          __html: plugin.details?.readme ?? 'No plugin help or readme markdown file was found',
        }}
      />
    );
  }

  if (pageId === PluginTabIds.VERSIONS) {
    return (
      <div>
        <VersionList versions={plugin.details?.versions} installedVersion={plugin.installedVersion} />
      </div>
    );
  }

  if (pageId === PluginTabIds.CHANGELOG && plugin?.details?.changelog) {
    return <Changelog sanitizedHTML={plugin?.details?.changelog} />;
  }

  if (pageId === PluginTabIds.CONFIG && pluginConfig?.angularConfigCtrl) {
    return (
      <div>
        <AppConfigCtrlWrapper app={pluginConfig as AppPlugin} />
      </div>
    );
  }

  // Permissions will be returned in the iam field for installed plugins and in the details.iam field when fetching details from gcom
  const permissions = plugin.iam?.permissions || plugin.details?.iam?.permissions;

  const displayPermissions =
    config.featureToggles.externalServiceAccounts &&
    pageId === PluginTabIds.IAM &&
    permissions &&
    permissions.length > 0;

  if (displayPermissions) {
    return (
      <>
        <Stack direction="row">
          The {plugin.name} plugin needs a service account to be able to query Grafana. The following list contains the
          permissions available to the service account:
        </Stack>
        <InteractiveTable
          columns={columns}
          data={permissions}
          getRowId={(permission: Permission) => String(permission.action)}
        />
      </>
    );
  }

  if (pluginConfig?.configPages) {
    for (const configPage of pluginConfig.configPages) {
      if (pageId === configPage.id) {
        return (
          <div>
            <PluginContextProvider meta={pluginConfig.meta}>
              <configPage.body plugin={pluginConfig} query={queryParams} />
            </PluginContextProvider>
          </div>
        );
      }
    }
  }

  if (pageId === PluginTabIds.USAGE && pluginConfig) {
    return (
      <div>
        <PluginUsage plugin={pluginConfig?.meta} />
      </div>
    );
  }

  if (pageId === PluginTabIds.DASHBOARDS && pluginConfig) {
    return (
      <div>
        <PluginDashboards plugin={pluginConfig?.meta} />
      </div>
    );
  }

  return (
    <div>
      <p>Page not found.</p>
    </div>
  );
}

export const getStyles = (theme: GrafanaTheme2) => ({
  readme: css({
    '& img': {
      maxWidth: '100%',
    },
    'h1, h2, h3': {
      marginTop: theme.spacing(3),
      marginBottom: theme.spacing(2),
    },
    '*:first-child': {
      marginTop: 0,
    },
    li: {
      marginLeft: theme.spacing(2),
      '& > p': {
        margin: theme.spacing(1, 0),
      },
    },
    a: {
      color: theme.colors.text.link,
      '&:hover': {
        color: theme.colors.text.link,
        textDecoration: 'underline',
      },
    },
    table: {
      tableLayout: 'fixed',
      width: '100%',
      'td, th': {
        overflowX: 'auto',
        padding: theme.spacing(0.5, 1),
      },
      'table, th, td': {
        border: `1px solid ${theme.colors.border.medium}`,
        borderCollapse: 'collapse',
      },
    },
  }),
});
