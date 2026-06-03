import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { type DataSourcePluginMeta, PluginType } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Badge, Button, TextLink } from '@grafana/ui';
import { addDataSource } from 'app/features/datasources/state/actions';
import { PluginDetailsPage } from 'app/features/plugins/admin/components/PluginDetailsPage';
import { isDataSourceEditor } from 'app/features/plugins/admin/permissions';
import { type CatalogPlugin } from 'app/features/plugins/admin/types';
import { AppNotificationSeverity } from 'app/types/appNotifications';
import { type StoreState, useDispatch, useSelector } from 'app/types/store';

import { ROUTES } from '../constants';

export function DataSourceDetailsPage() {
  const overrideNavId = 'standalone-plugin-page-/connections/add-new-connection';
  const { id = '' } = useParams<{ id: string }>();
  const navIndex = useSelector((state: StoreState) => state.navIndex);
  const isConnectDataPageOverriden = Boolean(navIndex[overrideNavId]);
  const navId = isConnectDataPageOverriden ? overrideNavId : 'connections-add-new-connection'; // The nav id changes (gets a prefix) if it is overriden by a plugin

  return (
    <PluginDetailsPage
      pluginId={id}
      navId={navId}
      actions={(plugin) => <DataSourcePluginAddButton plugin={plugin} />}
      notFoundComponent={<NotFoundDatasource />}
      notFoundNavModel={{
        text: t('connections.data-source-details-page.text.unknown-datasource', 'Unknown datasource'),
        subTitle: t(
          'connections.data-source-details-page.subTitle.datasource-could-found',
          'No datasource with this ID could be found.'
        ),
        active: true,
      }}
    />
  );
}

export function DataSourcePluginAddButton({ plugin }: { plugin?: CatalogPlugin }) {
  const dispatch = useDispatch();
  const [isAdding, setIsAdding] = useState(false);

  const onAddDataSource = useCallback(async () => {
    if (!plugin || isAdding) {
      return;
    }

    const meta: DataSourcePluginMeta = {
      id: plugin.id,
      name: plugin.name,
      type: PluginType.datasource,
      module: '',
      baseUrl: '',
      enabled: plugin.isInstalled,
      info: {
        author: {
          name: plugin.orgName,
        },
        description: plugin.description,
        links: plugin.details?.links ?? [],
        logos: plugin.info.logos,
        screenshots: plugin.details?.screenshots ?? [],
        updated: plugin.updatedAt,
        version: plugin.installedVersion ?? plugin.latestVersion ?? '',
      },
    };

    setIsAdding(true);

    try {
      await dispatch(addDataSource(meta, ROUTES.DataSourcesEdit));
    } catch {
      setIsAdding(false);
    }
  }, [dispatch, isAdding, plugin]);

  if (!plugin || plugin.type !== PluginType.datasource || !isDataSourceEditor()) {
    return null;
  }

  return (
    <Button icon={isAdding ? 'spinner' : 'plus'} disabled={isAdding} onClick={onAddDataSource}>
      {isAdding
        ? plugin.isInstalled
          ? t('connections.data-source-plugin-add-button.adding', 'Adding')
          : t('connections.data-source-plugin-add-button.installing', 'Installing')
        : t('connections.data-source-plugin-add-button.add', 'Add')}
    </Button>
  );
}

function NotFoundDatasource() {
  const { id } = useParams<{ id: string }>();

  return (
    <Alert severity={AppNotificationSeverity.Warning} title="">
      <Trans i18nKey="connections.not-found-datasource.body">
        Maybe you mistyped the URL or the plugin with the id <Badge text={id} color="orange" /> is unavailable.
        <br />
        To see a list of available datasources please <TextLink href={ROUTES.AddNewConnection}>click here</TextLink>.
      </Trans>
    </Alert>
  );
}
