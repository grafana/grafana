import { useState } from 'react';
import { useSearchParams } from 'react-router-dom-v5-compat';

import { PluginExtensionPoints } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config, usePluginLinks, useFavoriteDatasources, getDataSourceSrv, reportInteraction } from '@grafana/runtime';
import { Button, Dropdown, LinkButton, Menu, Icon, IconButton } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { SuggestedDashboardsModal } from 'app/features/dashboard/dashgrid/DashboardLibrary/SuggestedDashboardsModal';

import { ALLOWED_DATASOURCE_EXTENSION_PLUGINS } from '../constants';
import { useDataSource } from '../state/hooks';
import { trackCreateDashboardClicked, trackDsConfigClicked, trackExploreClicked } from '../tracking';
import { constructDataSourceExploreUrl } from '../utils';

import { INTERACTION_EVENT_NAME, INTERACTION_ITEM } from './picker/DataSourcePicker';

interface Props {
  uid: string;
}

const FavoriteButton = ({ uid }: { uid: string }) => {
  const favoriteDataSources = useFavoriteDatasources();
  const dataSourceInstance = getDataSourceSrv().getInstanceSettings(uid);
  const isFavorite = dataSourceInstance ? favoriteDataSources.isFavoriteDatasource(dataSourceInstance.uid) : false;

  return (
    favoriteDataSources.enabled &&
    dataSourceInstance &&
    !dataSourceInstance.meta.builtIn && (
      <IconButton
        key={`favorite-${isFavorite ? 'favorite-mono' : 'star-default'}`}
        name={isFavorite ? 'favorite' : 'star'}
        iconType={isFavorite ? 'mono' : 'default'}
        onClick={() => {
          reportInteraction(INTERACTION_EVENT_NAME, {
            item: INTERACTION_ITEM.TOGGLE_FAVORITE,
            ds_type: dataSourceInstance.type,
            is_favorite: !isFavorite,
          });
          isFavorite
            ? favoriteDataSources.removeFavoriteDatasource(dataSourceInstance)
            : favoriteDataSources.addFavoriteDatasource(dataSourceInstance);
        }}
        disabled={favoriteDataSources.isLoading}
        tooltip={
          isFavorite
            ? t('datasources.edit-data-source-actions.remove-favorite', 'Remove from favorites')
            : t('datasources.edit-data-source-actions.add-favorite', 'Add to favorites')
        }
        data-testid="favorite-button"
      />
    )
  );
};

export function EditDataSourceActions({ uid }: Props) {
  const dataSource = useDataSource(uid);
  const hasExploreRights = contextSrv.hasAccessToExplore();
  const [isSuggestedModalOpen, setIsSuggestedModalOpen] = useState(false);
  const [, setSearchParams] = useSearchParams();

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

  if (!dataSource.uid) {
    return null;
  }

  return (
    <>
      <FavoriteButton uid={uid} />
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
      <Dropdown
        overlay={
          <Menu>
            <Menu.Item
              label={t('datasources.edit-data-source-actions.from-suggestions', 'From suggestions')}
              icon="lightbulb-alt"
              onClick={() => {
                trackDsConfigClicked('build_a_dashboard');
                setSearchParams((params) => {
                  const newParams = new URLSearchParams(params);
                  newParams.set('dashboardLibraryDatasourceUid', dataSource.uid);
                  return newParams;
                });
                setIsSuggestedModalOpen(true);
              }}
            />
            <Menu.Item
              label={t('datasources.edit-data-source-actions.blank', 'Blank')}
              icon="plus"
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
          </Menu>
        }
      >
        <Button size="sm" variant="secondary">
          <Trans i18nKey="datasources.edit-data-source-actions.build-a-dashboard">Build a dashboard</Trans>
          <Icon name="angle-down" />
        </Button>
      </Dropdown>
      <SuggestedDashboardsModal
        isOpen={isSuggestedModalOpen}
        onDismiss={() => {
          setIsSuggestedModalOpen(false);
          setSearchParams((params) => {
            const newParams = new URLSearchParams(params);
            newParams.delete('dashboardLibraryDatasourceUid');
            return newParams;
          });
        }}
        defaultTab="datasource"
      />
    </>
  );
}
