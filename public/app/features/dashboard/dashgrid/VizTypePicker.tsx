import React, { PureComponent } from 'react';
import _ from 'lodash';

import config from 'app/core/config';
import { PanelPlugin } from 'app/types/plugins';
import VizTypePickerPlugin from './VizTypePickerPlugin';

export interface Props {
  current: PanelPlugin;
  onTypeChanged: (newType: PanelPlugin) => void;
  searchQuery: string;
  onClose: () => void;
}

export class VizTypePicker extends PureComponent<Props> {
  searchInput: HTMLElement;
  pluginList = this.getPanelPlugins('');

  constructor(props) {
    super(props);
  }

  get maxSelectedIndex() {
    const filteredPluginList = this.getFilteredPluginList();
    return filteredPluginList.length - 1;
  }

  getPanelPlugins(filter): PanelPlugin[] {
    const panels = _.chain(config.panels)
      .filter({ hideFromList: false })
      .map(item => item)
      .value();

    // add sort by sort property
    return _.sortBy(panels, 'sort');
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
    const { onClose } = this.props;
    const filteredPluginList = this.getFilteredPluginList();

    return (
      <div className="viz-picker">
        <div className="viz-picker-list">
          {filteredPluginList.map((plugin, index) => this.renderVizPlugin(plugin, index))}
        </div>
      </div>
    );
  }
}
