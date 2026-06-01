import { useState } from 'react';

import { PluginExtensionPoints } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import {
  config,
  usePluginLinks,
  useFavoriteDatasources,
  getDataSourceSrv,
  reportInteraction,
  isFetchError,
} from '@grafana/runtime';
import { Button, Dropdown, LinkButton, Menu, Icon, IconButton, Badge, Tooltip } from '@grafana/ui';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { notifyApp } from 'app/core/reducers/appNotification';
import { contextSrv } from 'app/core/services/context_srv';
import { useDispatch } from 'app/types/store';

import * as api from '../api';
import { ALLOWED_DATASOURCE_EXTENSION_PLUGINS } from '../constants';
import { useDataSource, useDataSourceRights } from '../state/hooks';
import { setIsDefault } from '../state/reducers';
import { trackDsConfigClicked, trackExploreClicked } from '../tracking';
import { constructDataSourceExploreUrl } from '../utils';

import { BuildDashboardButton } from './BuildDashboardButton';
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

const DefaultButton = ({ uid }: { uid: string }) => {
  const [loading, setLoading] = useState(false);

  const dataSource = useDataSource(uid);
  const rights = useDataSourceRights(uid);
  const editable = rights.hasWriteRights && !rights.readOnly;

  const dispatch = useDispatch();

  const onChangeDefault = async (value: boolean) => {
    if (loading) {
      return;
    }
    setLoading(true);

    try {
      // Make manual API calls to avoid pre-emptively saving other changes from the EditDataSource form
      const ds = await api.getDataSourceByUid(uid);
      await api.updateDataSource({ ...ds, isDefault: value });
      dispatch(setIsDefault(value));
    } catch (error) {
      dispatch(
        notifyApp(
          createErrorNotification(
            t('datasources.edit-data-source-actions.default-error', 'Failed to update default data source'),
            isFetchError(error) ? error.data.message : error instanceof Error ? error.message : undefined
          )
        )
      );
    }

    setLoading(false);
  };

  if (!editable) {
    return dataSource.isDefault ? (
      <Badge
        text={
          <Tooltip
            content={[
              t(
                'datasources.edit-data-source-actions.default-active',
                'This data source is currently set as the default.'
              ),
              t(
                'datasources.edit-data-source-actions.default-tooltip',
                'The default data source is preselected in new panels.'
              ),
            ].join(' ')}
          >
            <span>
              <Trans i18nKey="datasources.edit-data-source-actions.default-label">Default</Trans>
            </span>
          </Tooltip>
        }
        color="blue"
      />
    ) : null;
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      tooltip={[
        dataSource.isDefault &&
          t('datasources.edit-data-source-actions.default-active', 'This data source is currently set as the default.'),
        t(
          'datasources.edit-data-source-actions.default-tooltip',
          'The default data source is preselected in new panels.'
        ),
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => onChangeDefault(!dataSource.isDefault)}
      icon={loading ? 'spinner' : undefined}
      iconPlacement="right"
      disabled={loading}
    >
      {dataSource.isDefault ? (
        <Trans i18nKey="datasources.edit-data-source-actions.default-remove-button">Remove default</Trans>
      ) : (
        <Trans i18nKey="datasources.edit-data-source-actions.default-make-button">Make default</Trans>
      )}
    </Button>
  );
};

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
      <DefaultButton uid={uid} />
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
      <BuildDashboardButton dataSource={dataSource} size="sm" fill="solid" context="datasource_page" />
    </>
  );
}
