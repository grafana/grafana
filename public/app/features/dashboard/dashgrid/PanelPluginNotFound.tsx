// Libraries
import _ from 'lodash';
import React, { PureComponent } from 'react';

// Components
import { AlertBox } from 'app/core/components/AlertBox/AlertBox';

// Types
import { PanelProps } from '@grafana/ui';
import { PanelPlugin, AppNotificationSeverity } from 'app/types';

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
        <AlertBox severity={AppNotificationSeverity.Error} title={`Panel plugin not found: ${this.props.pluginId})`} />
      </div>
    );
  }
}

export function getPanelPluginNotFound(id: string): PanelPlugin {
  const NotFound = class NotFound extends PureComponent<PanelProps> {
    render() {
      return <PanelPluginNotFound pluginId={id} />;
    }
  };

  return {
    id: id,
    name: id,
    sort: 100,
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

    exports: {
      Panel: NotFound,
    },
  };
}
