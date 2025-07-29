import { PluginExtensionPoints } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { config, usePluginLinks } from '@grafana/runtime';
import { Button, Dropdown, LinkButton, Menu } from '@grafana/ui';
import { contextSrv } from 'app/core/core';

import { useDataSource } from '../state/hooks';
import { trackCreateDashboardClicked, trackDsConfigClicked, trackExploreClicked } from '../tracking';
import { constructDataSourceExploreUrl } from '../utils';

interface Props {
  uid: string;
}

const allowedPluginIds = [
  'grafana-lokiexplore-app',
  'grafana-exploretraces-app',
  'grafana-metricsdrilldown-app',
  'grafana-pyroscope-app',
  'grafana-monitoring-app',
  'grafana-troubleshooting-app',
];

export function EditDataSourceActions({ uid }: Props) {
  const dataSource = useDataSource(uid);
  const hasExploreRights = contextSrv.hasAccessToExplore();

  // Fetch plugin extension links
  const { links: allLinks, isLoading } = usePluginLinks({
    extensionPointId: PluginExtensionPoints.DataSourceConfigActions,
    context: {
      dataSource: {
        type: dataSource.type,
        uid: dataSource.uid,
        name: dataSource.name,
        typeName: dataSource.typeName,
      },
    },
    limitPerPlugin: 1,
  });

  const links = allLinks.filter((link) => allowedPluginIds.includes(link.pluginId));

  // Only render dropdown if there are multiple actions to show
  const hasActions = hasExploreRights || (!isLoading && links.length > 0);

  if (!hasActions) {
    // Always show at least the "Build a dashboard" action
    return (
      <LinkButton
        size="sm"
        variant="secondary"
        href={`dashboard/new-with-ds/${dataSource.uid}`}
        onClick={() => {
          trackDsConfigClicked('build_a_dashboard');
          trackCreateDashboardClicked({
            grafana_version: config.buildInfo.version,
            datasource_uid: dataSource.uid,
            plugin_name: dataSource.typeName,
            path: window.location.pathname,
          });
        }}
      >
        <Trans i18nKey="datasources.edit-data-source-actions.build-a-dashboard">Build a dashboard</Trans>
      </LinkButton>
    );
  }

  const actionsMenu = (
    <Menu>
      {hasExploreRights && (
        <Menu.Item
          label={t('datasources.edit-data-source-actions.explore-data', 'Explore data')}
          url={constructDataSourceExploreUrl(dataSource)}
          onClick={() => {
            trackDsConfigClicked('explore');
            trackExploreClicked({
              grafana_version: config.buildInfo.version,
              datasource_uid: dataSource.uid,
              plugin_name: dataSource.typeName,
              path: window.location.pathname,
            });
          }}
        />
      )}
      <Menu.Item
        label={t('datasources.edit-data-source-actions.build-a-dashboard', 'Build a dashboard')}
        url={`dashboard/new-with-ds/${dataSource.uid}`}
        onClick={() => {
          trackDsConfigClicked('build_a_dashboard');
          trackCreateDashboardClicked({
            grafana_version: config.buildInfo.version,
            datasource_uid: dataSource.uid,
            plugin_name: dataSource.typeName,
            path: window.location.pathname,
          });
        }}
      />
      {!isLoading &&
        links.map((link) => (
          <Menu.Item key={link.id} label={link.title} url={link.path} onClick={link.onClick} icon={link.icon} />
        ))}
    </Menu>
  );

  return (
    <Dropdown overlay={actionsMenu}>
      <Button variant="secondary" size="sm" icon="angle-down">
        <Trans i18nKey="datasources.edit-data-source-actions.actions">Actions</Trans>
      </Button>
    </Dropdown>
  );
}
