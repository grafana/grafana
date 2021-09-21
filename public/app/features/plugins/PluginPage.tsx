// Libraries
import React, { PureComponent } from 'react';
import { capitalize, find } from 'lodash';
// Types
import {
  AppPlugin,
  GrafanaPlugin,
  GrafanaTheme2,
  NavModel,
  NavModelItem,
  PluginDependencies,
  PluginInclude,
  PluginIncludeType,
  PluginMeta,
  PluginMetaInfo,
  PluginSignatureStatus,
  PluginSignatureType,
  PluginType,
  UrlQueryMap,
  PanelPluginMeta,
} from '@grafana/data';
import { AppNotificationSeverity } from 'app/types';
import { Alert, LinkButton, PluginSignatureBadge, Tooltip, Badge, useStyles2, Icon } from '@grafana/ui';

import Page from 'app/core/components/Page/Page';
import { getPluginSettings } from './PluginSettingsCache';
import { importAppPlugin, importDataSourcePlugin, importPanelPluginFromMeta } from './plugin_loader';
import { getNotFoundNav } from 'app/core/nav_model_srv';
import { PluginHelp } from 'app/core/components/PluginHelp/PluginHelp';
import { AppConfigCtrlWrapper } from './wrappers/AppConfigWrapper';
import { PluginDashboards } from './PluginDashboards';
import { appEvents } from 'app/core/core';
import { config } from 'app/core/config';
import { contextSrv } from '../../core/services/context_srv';
import { css } from '@emotion/css';
import { selectors } from '@grafana/e2e-selectors';
import { ShowModalReactEvent } from 'app/types/events';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { UpdatePluginModal } from './UpdatePluginModal';

interface Props extends GrafanaRouteComponentProps<{ pluginId: string }, UrlQueryMap> {}

interface State {
  loading: boolean;
  plugin?: GrafanaPlugin;
  nav: NavModel;
  defaultPage: string; // The first configured one or readme
}

const PAGE_ID_README = 'readme';
const PAGE_ID_DASHBOARDS = 'dashboards';
const PAGE_ID_CONFIG_CTRL = 'config';

class PluginPage extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      loading: true,
      nav: getLoadingNav(),
      defaultPage: PAGE_ID_README,
    };
  }

  async componentDidMount() {
    const { location, queryParams } = this.props;
    const { appSubUrl } = config;

    const plugin = await loadPlugin(this.props.match.params.pluginId);

    if (!plugin) {
      this.setState({
        loading: false,
        nav: getNotFoundNav(),
      });
      return; // 404
    }

    const { defaultPage, nav } = getPluginTabsNav(
      plugin,
      appSubUrl,
      location.pathname,
      queryParams,
      contextSrv.hasRole('Admin')
    );

    this.setState({
      loading: false,
      plugin,
      defaultPage,
      nav,
    });
  }

  componentDidUpdate(prevProps: Props) {
    const prevPage = prevProps.queryParams.page as string;
    const page = this.props.queryParams.page as string;

    if (prevPage !== page) {
      const { nav, defaultPage } = this.state;
      const node = {
        ...nav.node,
        children: setActivePage(page, nav.node.children!, defaultPage),
      };

      this.setState({
        nav: {
          node: node,
          main: node,
        },
      });
    }
  }

  renderBody() {
    const { queryParams } = this.props;
    const { plugin, nav } = this.state;

    if (!plugin) {
      return <Alert severity={AppNotificationSeverity.Error} title="Plugin Not Found" />;
    }

    const active = nav.main.children!.find((tab) => tab.active);
    if (active) {
      // Find the current config tab
      if (plugin.configPages) {
        for (const tab of plugin.configPages) {
          if (tab.id === active.id) {
            return <tab.body plugin={plugin} query={queryParams} />;
          }
        }
      }

      // Apps have some special behavior
      if (plugin.meta.type === PluginType.app) {
        if (active.id === PAGE_ID_DASHBOARDS) {
          return <PluginDashboards plugin={plugin.meta} />;
        }

        if (active.id === PAGE_ID_CONFIG_CTRL && plugin.angularConfigCtrl) {
          return <AppConfigCtrlWrapper app={plugin as AppPlugin} />;
        }
      }
    }

    return <PluginHelp plugin={plugin.meta} type="help" />;
  }

  showUpdateInfo = () => {
    const { id, name } = this.state.plugin!.meta;
    appEvents.publish(
      new ShowModalReactEvent({
        props: {
          id,
          name,
        },
        component: UpdatePluginModal,
      })
    );
  };

  renderVersionInfo(meta: PluginMeta) {
    if (!meta.info.version) {
      return null;
    }

    return (
      <section className="page-sidebar-section">
        <h4>Version</h4>
        <span>{meta.info.version}</span>
        {meta.hasUpdate && (
          <div>
            <Tooltip content={meta.latestVersion!} theme="info" placement="top">
              <LinkButton fill="text" onClick={this.showUpdateInfo}>
                Update Available!
              </LinkButton>
            </Tooltip>
          </div>
        )}
      </section>
    );
  }

  renderSidebarIncludeBody(item: PluginInclude) {
    if (item.type === PluginIncludeType.page) {
      const pluginId = this.state.plugin!.meta.id;
      const page = item.name.toLowerCase().replace(' ', '-');
      const url = item.path ?? `plugins/${pluginId}/page/${page}`;
      return (
        <a href={url}>
          <i className={getPluginIcon(item.type)} />
          {item.name}
        </a>
      );
    }
    return (
      <>
        <i className={getPluginIcon(item.type)} />
        {item.name}
      </>
    );
  }

  renderSidebarIncludes(includes?: PluginInclude[]) {
    if (!includes || !includes.length) {
      return null;
    }

    return (
      <section className="page-sidebar-section">
        <h4>Includes</h4>
        <ul className="ui-list plugin-info-list">
          {includes.map((include) => {
            return (
              <li className="plugin-info-list-item" key={include.name}>
                {this.renderSidebarIncludeBody(include)}
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  renderSidebarDependencies(dependencies?: PluginDependencies) {
    if (!dependencies) {
      return null;
    }

    return (
      <section className="page-sidebar-section">
        <h4>Dependencies</h4>
        <ul className="ui-list plugin-info-list">
          <li className="plugin-info-list-item">
            <img src="public/img/grafana_icon.svg" alt="Grafana logo" />
            Grafana {dependencies.grafanaVersion}
          </li>
          {dependencies.plugins &&
            dependencies.plugins.map((plug) => {
              return (
                <li className="plugin-info-list-item" key={plug.name}>
                  <i className={getPluginIcon(plug.type)} />
                  {plug.name} {plug.version}
                </li>
              );
            })}
        </ul>
      </section>
    );
  }

  renderSidebarLinks(info: PluginMetaInfo) {
    if (!info.links || !info.links.length) {
      return null;
    }

    return (
      <section className="page-sidebar-section">
        <h4>Links</h4>
        <ul className="ui-list">
          {info.links.map((link) => {
            return (
              <li key={link.url}>
                <a href={link.url} className="external-link" target="_blank" rel="noreferrer noopener">
                  {link.name}
                </a>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  renderPluginNotice() {
    const { plugin } = this.state;

    if (!plugin) {
      return null;
    }

    const isSignatureValid = plugin.meta.signature === PluginSignatureStatus.valid;

    if (plugin.meta.signature === PluginSignatureStatus.internal) {
      return null;
    }

    return (
      <Alert
        aria-label={selectors.pages.PluginPage.signatureInfo}
        severity={isSignatureValid ? 'info' : 'warning'}
        title="Plugin signature"
      >
        <div
          className={css`
            display: flex;
          `}
        >
          <PluginSignatureBadge
            status={plugin.meta.signature}
            className={css`
              margin-top: 0;
            `}
          />
          {isSignatureValid && (
            <PluginSignatureDetailsBadge
              signatureType={plugin.meta.signatureType}
              signatureOrg={plugin.meta.signatureOrg}
            />
          )}
        </div>
        <br />
        <p>
          Grafana Labs checks each plugin to verify that it has a valid digital signature. Plugin signature verification
          is part of our security measures to ensure plugins are safe and trustworthy.{' '}
          {!isSignatureValid &&
            'Grafana Labs can’t guarantee the integrity of this unsigned plugin. Ask the plugin author to request it to be signed.'}
        </p>
        <a
          href="https://grafana.com/docs/grafana/latest/plugins/plugin-signatures/"
          className="external-link"
          target="_blank"
          rel="noreferrer"
        >
          Read more about plugins signing.
        </a>
      </Alert>
    );
  }

  render() {
    const { loading, nav, plugin } = this.state;
    const isAdmin = contextSrv.hasRole('Admin');

    return (
      <Page navModel={nav} aria-label={selectors.pages.PluginPage.page}>
        <Page.Contents isLoading={loading}>
          {plugin && (
            <div className="sidebar-container">
              <div className="sidebar-content">
                {plugin.loadError && (
                  <Alert severity={AppNotificationSeverity.Error} title="Error Loading Plugin">
                    <>
                      Check the server startup logs for more information. <br />
                      If this plugin was loaded from git, make sure it was compiled.
                    </>
                  </Alert>
                )}
                {this.renderPluginNotice()}
                {this.renderBody()}
              </div>
              <aside className="page-sidebar">
                <section className="page-sidebar-section">
                  {this.renderVersionInfo(plugin.meta)}
                  {isAdmin && this.renderSidebarIncludes(plugin.meta.includes)}
                  {this.renderSidebarDependencies(plugin.meta.dependencies)}
                  {this.renderSidebarLinks(plugin.meta.info)}
                </section>
              </aside>
            </div>
          )}
        </Page.Contents>
      </Page>
    );
  }
}

function getPluginTabsNav(
  plugin: GrafanaPlugin,
  appSubUrl: string,
  path: string,
  query: UrlQueryMap,
  isAdmin: boolean
): { defaultPage: string; nav: NavModel } {
  const { meta } = plugin;
  let defaultPage: string | undefined;
  const pages: NavModelItem[] = [];

  pages.push({
    text: 'Readme',
    icon: 'file-alt',
    url: `${appSubUrl}${path}?page=${PAGE_ID_README}`,
    id: PAGE_ID_README,
  });

  // We allow non admins to see plugins but only their readme. Config is hidden
  // even though the API needs to be public for plugins to work properly.
  if (isAdmin) {
    // Only show Config/Pages for app
    if (meta.type === PluginType.app) {
      // Legacy App Config
      if (plugin.angularConfigCtrl) {
        pages.push({
          text: 'Config',
          icon: 'cog',
          url: `${appSubUrl}${path}?page=${PAGE_ID_CONFIG_CTRL}`,
          id: PAGE_ID_CONFIG_CTRL,
        });
        defaultPage = PAGE_ID_CONFIG_CTRL;
      }

      if (plugin.configPages) {
        for (const page of plugin.configPages) {
          pages.push({
            text: page.title,
            icon: page.icon,
            url: `${appSubUrl}${path}?page=${page.id}`,
            id: page.id,
          });

          if (!defaultPage) {
            defaultPage = page.id;
          }
        }
      }

      // Check for the dashboard pages
      if (find(meta.includes, { type: PluginIncludeType.dashboard })) {
        pages.push({
          text: 'Dashboards',
          icon: 'apps',
          url: `${appSubUrl}${path}?page=${PAGE_ID_DASHBOARDS}`,
          id: PAGE_ID_DASHBOARDS,
        });
      }
    }
  }

  if (!defaultPage) {
    defaultPage = pages[0].id; // the first tab
  }

  const node = {
    text: meta.name,
    img: meta.info.logos.large,
    subTitle: meta.info.author.name,
    breadcrumbs: [{ title: 'Plugins', url: 'plugins' }],
    url: `${appSubUrl}${path}`,
    children: setActivePage(query.page as string, pages, defaultPage!),
  };

  return {
    defaultPage: defaultPage!,
    nav: {
      node: node,
      main: node,
    },
  };
}

function setActivePage(pageId: string, pages: NavModelItem[], defaultPageId: string): NavModelItem[] {
  let found = false;
  const selected = pageId || defaultPageId;
  const changed = pages.map((p) => {
    const active = !found && selected === p.id;
    if (active) {
      found = true;
    }
    return { ...p, active };
  });

  if (!found) {
    changed[0].active = true;
  }

  return changed;
}

function getPluginIcon(type: string) {
  switch (type) {
    case 'datasource':
      return 'gicon gicon-datasources';
    case 'panel':
      return 'icon-gf icon-gf-panel';
    case 'app':
      return 'icon-gf icon-gf-apps';
    case 'page':
      return 'icon-gf icon-gf-endpoint-tiny';
    case 'dashboard':
      return 'gicon gicon-dashboard';
    default:
      return 'icon-gf icon-gf-apps';
  }
}

export function getLoadingNav(): NavModel {
  const node = {
    text: 'Loading...',
    icon: 'icon-gf icon-gf-panel',
  };
  return {
    node: node,
    main: node,
  };
}

export function loadPlugin(pluginId: string): Promise<GrafanaPlugin> {
  return getPluginSettings(pluginId).then((info) => {
    if (info.type === PluginType.app) {
      return importAppPlugin(info);
    }
    if (info.type === PluginType.datasource) {
      return importDataSourcePlugin(info);
    }
    if (info.type === PluginType.panel) {
      return importPanelPluginFromMeta(info as PanelPluginMeta);
    }
    if (info.type === PluginType.renderer) {
      return Promise.resolve({ meta: info } as GrafanaPlugin);
    }
    return Promise.reject('Unknown Plugin type: ' + info.type);
  });
}

type PluginSignatureDetailsBadgeProps = {
  signatureType?: PluginSignatureType;
  signatureOrg?: string;
};

const PluginSignatureDetailsBadge: React.FC<PluginSignatureDetailsBadgeProps> = ({ signatureType, signatureOrg }) => {
  const styles = useStyles2(getDetailsBadgeStyles);

  if (!signatureType && !signatureOrg) {
    return null;
  }

  const signatureTypeIcon =
    signatureType === PluginSignatureType.grafana
      ? 'grafana'
      : signatureType === PluginSignatureType.commercial || signatureType === PluginSignatureType.community
      ? 'shield'
      : 'shield-exclamation';

  const signatureTypeText = signatureType === PluginSignatureType.grafana ? 'Grafana Labs' : capitalize(signatureType);

  return (
    <>
      {signatureType && (
        <Badge
          color="green"
          className={styles.badge}
          text={
            <>
              <strong className={styles.strong}>Level:&nbsp;</strong>
              <Icon size="xs" name={signatureTypeIcon} />
              &nbsp;
              {signatureTypeText}
            </>
          }
        />
      )}
      {signatureOrg && (
        <Badge
          color="green"
          className={styles.badge}
          text={
            <>
              <strong className={styles.strong}>Signed by:</strong> {signatureOrg}
            </>
          }
        />
      )}
    </>
  );
};

const getDetailsBadgeStyles = (theme: GrafanaTheme2) => ({
  badge: css`
    background-color: ${theme.colors.background.canvas};
    border-color: ${theme.colors.border.strong};
    color: ${theme.colors.text.secondary};
    margin-left: ${theme.spacing()};
  `,
  strong: css`
    color: ${theme.colors.text.primary};
  `,
  icon: css`
    margin-right: ${theme.spacing(0.5)};
  `,
});

export default PluginPage;
