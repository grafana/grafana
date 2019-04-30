// Libraries
import _ from 'lodash';
import React, { PureComponent } from 'react';

// Components
import { AlertBox } from 'app/core/components/AlertBox/AlertBox';

// Types
import { AppNotificationSeverity } from 'app/types';
import { PanelPluginMeta, PanelProps, PanelPlugin, PluginType } from '@grafana/ui';

interface Props {
  pluginId: string;
}

class PanelPluginNotFound extends PureComponent<Props> {
  constructor(props) {
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
        <AlertBox severity={AppNotificationSeverity.Error} title={`Panel plugin not found: ${this.props.pluginId}`} />
      </div>
    );
  }
}

export function getPanelPluginNotFound(id: string): PanelPluginMeta {
  const NotFound = class NotFound extends PureComponent<PanelProps> {
    render() {
      return <PanelPluginNotFound pluginId={id} />;
    }
  };

  return {
    id: id,
    name: id,
    sort: 100,
    type: PluginType.panel,
    module: '',
    baseUrl: '',
    dataFormats: [],
    info: {
      author: {
        name: '',
      },
      description: '',
      links: [],
      logos: {
        large: '',
        small: '',
      },
      screenshots: [],
      updated: '',
      version: '',
    },
    panelPlugin: new PanelPlugin(NotFound),
    angularPlugin: null,
  };
}
