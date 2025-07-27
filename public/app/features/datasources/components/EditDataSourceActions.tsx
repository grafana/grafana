import { PluginExtensionPoints } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { config, usePluginLinks } from '@grafana/runtime';
import { LinkButton } from '@grafana/ui';
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

  return (
    <>
      {hasExploreRights && (
        <LinkButton
          variant="secondary"
          size="sm"
          href={constructDataSourceExploreUrl(dataSource)}
          onClick={() => {
            trackDsConfigClicked('explore');
            trackExploreClicked({
              grafana_version: config.buildInfo.version,
              datasource_uid: dataSource.uid,
              plugin_name: dataSource.typeName,
              path: window.location.pathname,
            });
          }}
        >
          <Trans i18nKey="datasources.edit-data-source-actions.explore-data">Explore data</Trans>
        </LinkButton>
      )}
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

      {!isLoading &&
        links.map((link) => (
          <LinkButton
            key={link.id}
            size="sm"
            variant="secondary"
            href={link.path}
            onClick={link.onClick}
            icon={link.icon}
            tooltip={link.description}
          >
            {link.title}
          </LinkButton>
        ))}
    </>
  );
}
