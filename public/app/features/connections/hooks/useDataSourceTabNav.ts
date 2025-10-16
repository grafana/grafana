import { useLocation, useParams } from 'react-router-dom-v5-compat';

import { NavModel, NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import { getNavModel } from 'app/core/selectors/navModel';
import { useDataSource, useDataSourceMeta, useDataSourceSettings } from 'app/features/datasources/state/hooks';
import { getDataSourceLoadingNav, buildNavModel, getDataSourceNav } from 'app/features/datasources/state/navModel';
import { useGetSingle } from 'app/features/plugins/admin/state/hooks';
import { useSelector } from 'app/types/store';

export function useDataSourceTabNav(pageName: string, pageIdParam?: string) {
  const { uid = '' } = useParams<{ uid: string }>();
  const location = useLocation();
  const datasource = useDataSource(uid);
  const dataSourceMeta = useDataSourceMeta(datasource.type);
  const datasourcePlugin = useGetSingle(datasource.type);
  const params = new URLSearchParams(location.search);
  const pageId = pageIdParam || params.get('page');

  const { plugin, loadError, loading } = useDataSourceSettings();
  const dsi = getDataSourceSrv()?.getInstanceSettings(uid);
  const hasAlertingEnabled = Boolean(dsi?.meta?.alerting ?? false);
  const isAlertManagerDatasource = dsi?.type === 'alertmanager';
  const alertingSupported = hasAlertingEnabled || isAlertManagerDatasource;

  const navIndex = useSelector((state) => state.navIndex);
  const navIndexId = pageId ? `datasource-${pageId}-${uid}` : `datasource-${pageName}-${uid}`;

  let pageNav: NavModel = {
    node: {
      text: t('connections.use-data-source-settings-nav.page-nav.text.data-source-nav-node', 'Data Source Nav Node'),
    },
    main: {
      text: t('connections.use-data-source-settings-nav.page-nav.text.data-source-nav-node', 'Data Source Nav Node'),
    },
  };

  if (loadError) {
    const node: NavModelItem = {
      text: loadError,
      subTitle: t('connections.use-data-source-settings-nav.node.subTitle.data-source-error', 'Data Source Error'),
      icon: 'exclamation-triangle',
    };

    pageNav = {
      node: node,
      main: node,
    };
  }

  if (loading || !plugin) {
    pageNav = getNavModel(navIndex, navIndexId, getDataSourceLoadingNav(pageName));
  }

  if (!datasource.uid) {
    const node: NavModelItem = {
      text: t('connections.use-data-source-settings-nav.node.subTitle.data-source-error', 'Data Source Error'),
      icon: 'exclamation-triangle',
    };

    pageNav = {
      node: node,
      main: node,
    };
  }

  if (plugin) {
    pageNav = getNavModel(
      navIndex,
      navIndexId,
      getDataSourceNav(buildNavModel(datasource, plugin), pageId || pageName)
    );
  }

  const connectionsPageNav = {
    ...pageNav.main,
    dataSourcePluginName: datasourcePlugin?.name || plugin?.meta.name || '',
    active: true,
    text: datasource.name || '',
    subTitle: dataSourceMeta.name ? `Type: ${dataSourceMeta.name}` : '',
    children: (pageNav.main.children || []).map((navModelItem) => ({
      ...navModelItem,
      url: navModelItem.url?.replace('datasources/edit/', '/connections/datasources/edit/'),
    })),
  };

  return {
    navId: 'connections-datasources',
    pageNav: connectionsPageNav,
    dataSourceHeader: {
      alertingSupported,
    },
  };
}
