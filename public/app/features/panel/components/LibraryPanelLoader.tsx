// Libraries
import React from 'react';

// Types
import { PanelPlugin, PluginType } from '@grafana/data';
import { PanelModel } from 'app/features/dashboard/state';

export function getLibraryPanelLoadingView(panel: PanelModel): PanelPlugin {
  const LoaderView = () => {
    const style = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
    };

    return <div style={style}>Loading library panel: {panel.libraryPanel?.uid}</div>;
  };

  const plugin = new PanelPlugin(LoaderView);

  plugin.meta = {
    id: 'libarry-panel-loader',
    name: 'libarry-panel-loader',
    sort: 100,
    type: PluginType.panel,
    skipDataQuery: true,
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
