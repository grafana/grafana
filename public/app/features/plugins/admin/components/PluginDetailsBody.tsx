import { css } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2, PluginContextProvider, UrlQueryMap, PluginType } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { PageInfoItem } from '@grafana/runtime/internal';
import { CellProps, Column, InteractiveTable, Stack, useStyles2, Carousel } from '@grafana/ui';

import { Changelog } from '../components/Changelog';
import { PluginDetailsPanel } from '../components/PluginDetailsPanel';
import { VersionList } from '../components/VersionList';
import { shouldDisablePluginInstall } from '../helpers';
import { usePluginConfig } from '../hooks/usePluginConfig';
import { CatalogPlugin, Permission, PluginTabIds, Screenshots } from '../types';

import Connections from './ConnectionsTab';
import { PluginDashboards } from './PluginDashboards';
import { PluginUsage } from './PluginUsage';

type Props = {
  plugin: CatalogPlugin;
  info: PageInfoItem[];
  queryParams: UrlQueryMap;
  pageId: string;
  showDetails: boolean;
};

type Cell<T extends keyof Permission = keyof Permission> = CellProps<Permission, Permission[T]>;

export function PluginDetailsBody({ plugin, queryParams, pageId, info, showDetails }: Props): JSX.Element {
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

  const buildScreenshotPath = (plugin: CatalogPlugin, path: string) => {
    return `${config.appSubUrl}/api/gnet/plugins/${plugin.id}/versions/${plugin.latestVersion}/images/${path}`;
  };

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
        <VersionList
          pluginId={plugin.id}
          versions={plugin.details?.versions}
          installedVersion={plugin.installedVersion}
          disableInstallation={shouldDisablePluginInstall(plugin)}
        />
      </div>
    );
  }

  if (pageId === PluginTabIds.CHANGELOG && plugin?.details?.changelog) {
    return <Changelog sanitizedHTML={plugin?.details?.changelog} />;
  }

  if (pageId === PluginTabIds.SCREENSHOTS && plugin?.details?.screenshots?.length) {
    const carouselImages: Screenshots[] = plugin?.details?.screenshots.map((screenshot) => ({
      path: buildScreenshotPath(plugin, screenshot.path),
      name: screenshot.name,
    }));
    return <Carousel images={carouselImages} />;
  }

  if (pageId === PluginTabIds.PLUGINDETAILS && showDetails) {
    return (
      <div>
        <PluginDetailsPanel pluginExtentionsInfo={info} plugin={plugin} width={'auto'} />
      </div>
    );
  }

  if (
    config.featureToggles.datasourceConnectionsTab &&
    pageId === PluginTabIds.DATASOURCE_CONNECTIONS &&
    plugin.type === PluginType.datasource
  ) {
    return (
      <div>
        <Connections plugin={plugin} />
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
          <Trans i18nKey="plugins.plugin-details-body.needs-service-account" values={{ pluginName: plugin.name }}>
            The {'{{pluginName}}'} plugin needs a service account to be able to query Grafana. The following list
            contains the permissions available to the service account:
          </Trans>
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
      <div className={styles.wrap}>
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
      <p>
        <Trans i18nKey="plugins.plugin-details-body.page-not-found">Page not found.</Trans>
      </p>
    </div>
  );
}

export const getStyles = (theme: GrafanaTheme2) => ({
  wrap: css({
    width: '100%',
    height: '50vh',
  }),
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
      code: {
        whiteSpace: 'pre-wrap',
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
