import React, { PureComponent } from 'react';
import _ from 'lodash';

import config from 'app/core/config';
import { PanelPlugin } from 'app/types/plugins';
import VizTypePickerPlugin from './VizTypePickerPlugin';

interface Props {
  current: PanelPlugin;
  onTypeChanged: (newType: PanelPlugin) => void;
}

interface State {
  searchQuery: string;
  selected: number;
}

export class VizTypePicker extends PureComponent<Props, State> {
  searchInput: HTMLElement;
  pluginList = this.getPanelPlugins('');

  constructor(props) {
    super(props);

    this.state = {
      searchQuery: '',
      selected: 0,
    };
  }

  get maxSelectedIndex() {
    const filteredPluginList = this.getFilteredPluginList();
    return filteredPluginList.length - 1;
  }

  goRight = () => {
    const nextIndex = this.state.selected >= this.maxSelectedIndex ? 0 : this.state.selected + 1;
    this.setState({
      selected: nextIndex,
    });
  };

  goLeft = () => {
    const nextIndex = this.state.selected <= 0 ? this.maxSelectedIndex : this.state.selected - 1;
    this.setState({
      selected: nextIndex,
    });
  };

  onKeyDown = evt => {
    if (evt.key === 'ArrowDown') {
      evt.preventDefault();
      this.goRight();
    }
    if (evt.key === 'ArrowUp') {
      evt.preventDefault();
      this.goLeft();
    }
    if (evt.key === 'Enter') {
      const filteredPluginList = this.getFilteredPluginList();
      this.props.onTypeChanged(filteredPluginList[this.state.selected]);
    }
  };

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

  onMouseEnter = (mouseEnterIndex: number) => {
    this.setState({
      selected: mouseEnterIndex,
    });
  };

  renderVizPlugin = (plugin: PanelPlugin, index: number) => {
    const isSelected = this.state.selected === index;
    const isCurrent = plugin.id === this.props.current.id;
    return (
      <VizTypePickerPlugin
        key={plugin.id}
        isSelected={isSelected}
        isCurrent={isCurrent}
        plugin={plugin}
        onMouseEnter={() => {
          this.onMouseEnter(index);
        }}
        onClick={() => this.props.onTypeChanged(plugin)}
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
      selected: 0,
    }));
  };

  renderFilters = () => {
    return (
      <>
        <label className="gf-form--has-input-icon">
          <input
            type="text"
            className="gf-form-input width-13"
            placeholder=""
            ref={elem => (this.searchInput = elem)}
            onChange={this.onSearchQueryChange}
            onKeyDown={this.onKeyDown}
          />
          <i className="gf-form-input-icon fa fa-search" />
        </label>
      </>
    );
  };

  render() {
    const filteredPluginList = this.getFilteredPluginList();

    return (
      <>
        <div className="cta-form__bar">
          {this.renderFilters()}
          <div className="gf-form--grow" />
        </div>
        <div className="viz-picker">{filteredPluginList.map(this.renderVizPlugin)}</div>
      </>
    );
  }
}
