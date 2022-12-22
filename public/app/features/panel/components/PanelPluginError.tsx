// Libraries
import React, { PureComponent, ReactNode } from 'react';

// Types
import { PanelProps, PanelPlugin, PluginType, PanelPluginMeta } from '@grafana/data';
import { Alert } from '@grafana/ui';
import { AppNotificationSeverity } from 'app/types';

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

export function getPanelPluginLoadError(meta: PanelPluginMeta, err: any): PanelPlugin {
  const LoadError = class LoadError extends PureComponent<PanelProps> {
    render() {
      const text = (
        <>
          Check the server startup logs for more information. <br />
          If this plugin was loaded from Git, then make sure it was compiled.
        </>
      );
      return <PanelPluginError title={`Error loading: ${meta.id}`} text={text} />;
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
      return <PanelPluginError title={`Panel plugin not found: ${id}`} />;
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
        small: 'public/img/grafana_icon.svg',
      },
      screenshots: [],
      updated: '',
      version: '',
    },
  };
  return plugin;
}
