import React, { PureComponent } from 'react';
import _ from 'lodash';

import config from 'app/core/config';
import { PanelPlugin } from 'app/types/plugins';
import VizTypePickerPlugin from './VizTypePickerPlugin';
import KeyboardNavigation, { KeyboardNavigationProps } from './KeyboardNavigation';

export interface Props {
  current: PanelPlugin;
  onTypeChanged: (newType: PanelPlugin) => void;
}

interface State {
  searchQuery: string;
}

export class VizTypePicker extends PureComponent<Props, State> {
  searchInput: HTMLElement;
  pluginList = this.getPanelPlugins('');

  constructor(props) {
    super(props);

    this.state = {
      searchQuery: '',
    };
  }

  get maxSelectedIndex() {
    const filteredPluginList = this.getFilteredPluginList();
    return filteredPluginList.length - 1;
  }

  componentDidMount() {
    setTimeout(() => {
      this.searchInput.focus();
    }, 300);
  }

  getPanelPlugins(filter): PanelPlugin[] {
    const panels = _.chain(config.panels)
      .filter({ hideFromList: false })
      .map(item => item)
      .value();

    // add sort by sort property
    return _.sortBy(panels, 'sort');
  }

  renderVizPlugin = (plugin: PanelPlugin, index: number, keyNavProps: KeyboardNavigationProps) => {
    const { onTypeChanged } = this.props;
    const { selected, onMouseEnter } = keyNavProps;
    const isSelected = selected === index;
    const isCurrent = plugin.id === this.props.current.id;
    return (
      <VizTypePickerPlugin
        key={plugin.id}
        isSelected={isSelected}
        isCurrent={isCurrent}
        plugin={plugin}
        onMouseEnter={() => {
          onMouseEnter(index);
        }}
        onClick={() => onTypeChanged(plugin)}
      />
    );
  };

  getFilteredPluginList = (): PanelPlugin[] => {
    const { searchQuery } = this.state;
    const regex = new RegExp(searchQuery, 'i');
    const pluginList = this.pluginList;

    const filtered = pluginList.filter(item => {
      return regex.test(item.name);
    });

    return filtered;
  };

  onSearchQueryChange = evt => {
    const value = evt.target.value;
    this.setState(prevState => ({
      ...prevState,
      searchQuery: value,
    }));
  };

  renderFilters = ({ onKeyDown, selected }: KeyboardNavigationProps) => {
    const { searchQuery } = this.state;
    return (
      <>
        <label className="gf-form--has-input-icon">
          <input
            type="text"
            className="gf-form-input width-13"
            placeholder=""
            ref={elem => (this.searchInput = elem)}
            onChange={this.onSearchQueryChange}
            value={searchQuery}
            onKeyDown={evt => {
              onKeyDown(evt, this.maxSelectedIndex, () => {
                const { onTypeChanged } = this.props;
                const vizType = this.getFilteredPluginList()[selected];
                onTypeChanged(vizType);
              });
            }}
          />
          <i className="gf-form-input-icon fa fa-search" />
        </label>
      </>
    );
  };

  render() {
    const filteredPluginList = this.getFilteredPluginList();

    return (
      <KeyboardNavigation
        render={(keyNavProps: KeyboardNavigationProps) => (
          <>
            <div className="cta-form__bar">
              {this.renderFilters(keyNavProps)}
              <div className="gf-form--grow" />
            </div>
            <div className="viz-picker">
              {filteredPluginList.map((plugin, index) => this.renderVizPlugin(plugin, index, keyNavProps))}
            </div>
          </>
        )}
      />
    );
  }
}
