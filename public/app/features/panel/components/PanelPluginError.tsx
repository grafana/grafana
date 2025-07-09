// Libraries
import { PureComponent, ReactNode } from 'react';

// Types
import { PanelProps, PanelPlugin, PluginType, PanelPluginMeta } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';
import { AppNotificationSeverity } from 'app/types/appNotifications';
import grafanaIconSvg from 'img/grafana_icon.svg';

interface Props {
  title: string;
  text?: ReactNode;
}

class PanelPluginError extends PureComponent<Props> {
  constructor(props: Props) {
    super(props);
  }

  render() {
    const style = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
    };

    return (
      <div style={style}>
        <Alert severity={AppNotificationSeverity.Error} {...this.props} />
      </div>
    );
  }
}

export function getPanelPluginLoadError(meta: PanelPluginMeta, err: unknown): PanelPlugin {
  const LoadError = class LoadError extends PureComponent<PanelProps> {
    render() {
      const text = (
        <Trans i18nKey="panel.panel-plugin-error.text-load-error">
          Check the server startup logs for more information. <br />
          If this plugin was loaded from Git, then make sure it was compiled.
        </Trans>
      );
      return (
        <PanelPluginError
          title={t('panel.panel-plugin-error.title-load-error', 'Error loading: {{panelId}}', { panelId: meta.id })}
          text={text}
        />
      );
    }
  };
  const plugin = new PanelPlugin(LoadError);
  plugin.meta = meta;
  plugin.loadError = true;
  return plugin;
}

export function getPanelPluginNotFound(id: string, silent?: boolean): PanelPlugin {
  const NotFound = class NotFound extends PureComponent<PanelProps> {
    render() {
      return (
        <PanelPluginError
          title={t('panel.panel-plugin-error.title-not-found', 'Panel plugin not found: {{id}}', { id })}
        />
      );
    }
  };

  const plugin = new PanelPlugin(silent ? () => null : NotFound);

  plugin.meta = {
    id: id,
    name: id,
    sort: 100,
    type: PluginType.panel,
    module: '',
    baseUrl: '',
    info: {
      author: {
        name: '',
      },
      description: '',
      links: [],
      logos: {
        large: '',
        small: grafanaIconSvg,
      },
      screenshots: [],
      updated: '',
      version: '',
    },
  };
  return plugin;
}
