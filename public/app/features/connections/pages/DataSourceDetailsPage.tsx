import * as React from 'react';
import { useParams } from 'react-router-dom';

import { Alert, Badge } from '@grafana/ui';
import { PluginDetailsPage } from 'app/features/plugins/admin/components/PluginDetailsPage';
import { StoreState, useSelector, AppNotificationSeverity } from 'app/types';

import { ROUTES } from '../constants';

export function DataSourceDetailsPage() {
  const overrideNavId = 'standalone-plugin-page-/connections/add-new-connection';
  const { id } = useParams<{ id: string }>();
  const navIndex = useSelector((state: StoreState) => state.navIndex);
  const isConnectDataPageOverriden = Boolean(navIndex[overrideNavId]);
  const navId = isConnectDataPageOverriden ? overrideNavId : 'connections-add-new-connection'; // The nav id changes (gets a prefix) if it is overriden by a plugin

  return (
    <PluginDetailsPage
      pluginId={id}
      navId={navId}
      notFoundComponent={<NotFoundDatasource />}
      notFoundNavModel={{
        text: 'Unknown datasource',
        subTitle: 'No datasource with this ID could be found.',
        active: true,
      }}
    />
  );
}

function NotFoundDatasource() {
  const { id } = useParams<{ id: string }>();

  return (
    <Alert severity={AppNotificationSeverity.Warning} title="">
      Maybe you mistyped the URL or the plugin with the id <Badge text={id} color="orange" /> is unavailable.
      <br />
      To see a list of available datasources please <a href={ROUTES.AddNewConnection}>click here</a>.
    </Alert>
  );
}
