import { useParams } from 'react-router-dom-v5-compat';

import { Trans, t } from '@grafana/i18n';
import { Alert, Badge, TextLink } from '@grafana/ui';
import { PluginDetailsPage } from 'app/features/plugins/admin/components/PluginDetailsPage';
import { AppNotificationSeverity } from 'app/types/appNotifications';
import { StoreState, useSelector } from 'app/types/store';

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
