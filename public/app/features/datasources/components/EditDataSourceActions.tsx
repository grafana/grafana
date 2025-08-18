import { PluginExtensionPoints } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config, usePluginLinks, useFavoriteDatasources, getDataSourceSrv } from '@grafana/runtime';
import { Button, Dropdown, LinkButton, Menu, Icon, IconButton } from '@grafana/ui';
import { contextSrv } from 'app/core/core';

import { ALLOWED_DATASOURCE_EXTENSION_PLUGINS } from '../constants';
import { useToggleFavoriteDatasource } from '../hooks';
import { useDataSource } from '../state/hooks';
import { trackCreateDashboardClicked, trackDsConfigClicked, trackExploreClicked } from '../tracking';
import { constructDataSourceExploreUrl } from '../utils';

interface Props {
  uid: string;
}

export function EditDataSourceActions({ uid }: Props) {
  const dataSource = useDataSource(uid);
  const dataSourceInstance = getDataSourceSrv().getInstanceSettings(uid);
  const hasExploreRights = contextSrv.hasAccessToExplore();
  const favoriteDataSources = useFavoriteDatasources();
  const toggleFavoriteDatasource = useToggleFavoriteDatasource(favoriteDataSources);
  const isFavorite = dataSourceInstance ? favoriteDataSources.isFavoriteDatasource(dataSourceInstance.uid) : false;

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

  const handleExploreClick = () => {
    trackDsConfigClicked('explore');
    trackExploreClicked({
      grafana_version: config.buildInfo.version,
      datasource_uid: dataSource.uid,
      plugin_name: dataSource.typeName,
      path: window.location.pathname,
    });
  };

  const exploreMenu = (
    <Menu>
      <Menu.Item
        label={t('datasources.edit-data-source-actions.open-in-explore', 'Open in Explore View')}
        url={constructDataSourceExploreUrl(dataSource)}
        onClick={handleExploreClick}
        icon="compass"
      />
      {links.map((link) => (
        <Menu.Item key={link.id} label={link.title} url={link.path} onClick={link.onClick} icon={link.icon} />
      ))}
    </Menu>
  );

  return (
    <>
      {favoriteDataSources.enabled && dataSourceInstance && !dataSourceInstance.meta.builtIn && (
        <IconButton
          key={`favorite-${isFavorite ? 'favorite-mono' : 'star-default'}`}
          name={isFavorite ? 'favorite' : 'star'}
          iconType={isFavorite ? 'mono' : 'default'}
          onClick={() => toggleFavoriteDatasource(dataSourceInstance)}
          disabled={favoriteDataSources.isLoading}
          tooltip={
            isFavorite
              ? t('datasources.edit-data-source-actions.remove-favorite', 'Remove from favorites')
              : t('datasources.edit-data-source-actions.add-favorite', 'Add to favorites')
          }
        />
      )}
      {hasExploreRights && (
        <>
          {!hasActions ? (
            <LinkButton
              variant="secondary"
              size="sm"
              href={constructDataSourceExploreUrl(dataSource)}
              onClick={handleExploreClick}
            >
              <Trans i18nKey="datasources.edit-data-source-actions.explore-data">Explore data</Trans>
            </LinkButton>
          ) : (
            <Dropdown overlay={exploreMenu}>
              <Button variant="secondary" size="sm">
                <Trans i18nKey="datasources.edit-data-source-actions.explore-data">Explore data</Trans>
                <Icon name="angle-down" />
              </Button>
            </Dropdown>
          )}
        </>
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
    </>
  );
}
