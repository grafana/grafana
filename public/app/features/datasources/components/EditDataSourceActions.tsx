import { PluginExtensionPoints } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { config, usePluginLinks } from '@grafana/runtime';
import { Button, Dropdown, LinkButton, Menu, Icon } from '@grafana/ui';
import { contextSrv } from 'app/core/core';

import { ALLOWED_DATASOURCE_EXTENSION_PLUGINS } from '../constants';
import { useDataSource } from '../state/hooks';
import { trackCreateDashboardClicked, trackDsConfigClicked, trackExploreClicked } from '../tracking';
import { constructDataSourceExploreUrl } from '../utils';

interface Props {
  uid: string;
}

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

  const links = allLinks.filter((link) => ALLOWED_DATASOURCE_EXTENSION_PLUGINS.includes(link.pluginId));

  // Only render dropdown if there are multiple actions to show
  const hasActions = !isLoading && links.length > 0;

  const actionsMenu = (
    <Menu>
      {hasActions &&
        links.map((link) => (
          <Menu.Item key={link.id} label={link.title} url={link.path} onClick={link.onClick} icon={link.icon} />
        ))}
    </Menu>
  );

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
      {hasActions && (
        <Dropdown overlay={actionsMenu}>
          <Button variant="secondary" size="sm" icon="plug">
            <Trans i18nKey="datasources.edit-data-source-actions.extensions">Extensions</Trans>
            <Icon name="angle-down" />
          </Button>
        </Dropdown>
      )}
    </>
  );
}
