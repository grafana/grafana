import React, { PureComponent } from 'react';

import config from 'app/core/config';
import VizTypePickerPlugin from './VizTypePickerPlugin';
import { EmptySearchResult } from '@grafana/ui';
import { PanelPluginMeta } from '@grafana/data';

export interface Props {
  current: PanelPluginMeta;
  onTypeChange: (newType: PanelPluginMeta) => void;
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

  get getPanelPlugins(): PanelPluginMeta[] {
    const allPanels = config.panels;

    return Object.keys(allPanels)
      .filter(key => allPanels[key]['hideFromList'] === false)
      .map(key => allPanels[key])
      .sort((a: PanelPluginMeta, b: PanelPluginMeta) => a.sort - b.sort);
  }

  renderVizPlugin = (plugin: PanelPluginMeta, index: number) => {
    const { onTypeChange } = this.props;
    const isCurrent = plugin.id === this.props.current.id;

    return (
      <VizTypePickerPlugin key={plugin.id} isCurrent={isCurrent} plugin={plugin} onClick={() => onTypeChange(plugin)} />
    );
  };

  getFilteredPluginList = (): PanelPluginMeta[] => {
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
