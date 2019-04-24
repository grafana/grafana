import React, { PureComponent } from 'react';

import config from 'app/core/config';
import { PanelPlugin } from 'app/types/plugins';
import VizTypePickerPlugin from './VizTypePickerPlugin';
import { EmptySearchResult } from '@grafana/ui';

export interface Props {
  current: PanelPlugin;
  onTypeChanged: (newType: PanelPlugin) => void;
  searchQuery: string;
  onClose: () => void;
}

export class VizTypePicker extends PureComponent<Props> {
  searchInput: HTMLElement;
  pluginList = this.getPanelPlugins;

  constructor(props: Props) {
    super(props);
  }

  get maxSelectedIndex() {
    const filteredPluginList = this.getFilteredPluginList();
    return filteredPluginList.length - 1;
  }

  get getPanelPlugins(): PanelPlugin[] {
    const allPanels = config.panels;

    return Object.keys(allPanels)
      .filter(key => allPanels[key]['hideFromList'] === false)
      .map(key => allPanels[key])
      .sort((a: PanelPlugin, b: PanelPlugin) => a.sort - b.sort);
  }

  renderVizPlugin = (plugin: PanelPlugin, index: number) => {
    const { onTypeChanged } = this.props;
    const isCurrent = plugin.id === this.props.current.id;

    return (
      <VizTypePickerPlugin
        key={plugin.id}
        isCurrent={isCurrent}
        plugin={plugin}
        onClick={() => onTypeChanged(plugin)}
      />
    );
  };

  getFilteredPluginList = (): PanelPlugin[] => {
    const { searchQuery } = this.props;
    const regex = new RegExp(searchQuery, 'i');
    const pluginList = this.pluginList;

    const filtered = pluginList.filter(item => {
      return regex.test(item.name);
    });

    return filtered;
  };

  render() {
    const filteredPluginList = this.getFilteredPluginList();
    const hasResults = filteredPluginList.length > 0;
    return (
      <div className="viz-picker">
        <div className="viz-picker-list">
          {hasResults ? (
            filteredPluginList.map((plugin, index) => this.renderVizPlugin(plugin, index))
          ) : (
            <EmptySearchResult>Could not find anything matching your query</EmptySearchResult>
          )}
        </div>
      </div>
    );
  }
}
