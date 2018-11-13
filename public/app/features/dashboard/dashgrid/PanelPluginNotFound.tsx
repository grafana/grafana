import _ from 'lodash';
import React, { PureComponent } from 'react';
import { PanelPlugin, PanelProps } from 'app/types';

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
      'align-items': 'center',
      'text-align': 'center',
      height: '100%',
    };

    return (
      <div style={style}>
        <div className="alert alert-error" style={{ margin: '0 auto' }}>
          Panel plugin with id {this.props.pluginId} could not be found
        </div>
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

  const info = {
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
  };

  return {
    id: id,
    name: id,
    sort: 100,
    module: '',
    baseUrl: '',
    meta: {
      id: id,
      name: id,
      info: info,
      includes: [],
    },
    info: info,
    exports: {
      PanelComponent: NotFound,
    },
  };
}
