import React, { PureComponent } from 'react';
import classNames from 'classnames';
import _ from 'lodash';

import config from 'app/core/config';
import { PanelPlugin } from 'app/types/plugins';

interface Props {
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

  getPanelPlugins(filter): PanelPlugin[] {
    const panels = _.chain(config.panels)
      .filter({ hideFromList: false })
      .map(item => item)
      .value();

    // add sort by sort property
    return _.sortBy(panels, 'sort');
  }

  renderVizPlugin = (plugin: PanelPlugin, index: number) => {
    const cssClass = classNames({
      'viz-picker__item': true,
      'viz-picker__item--selected': plugin.id === this.props.current.id,
    });

    return (
      <div key={index} className={cssClass} onClick={() => this.props.onTypeChanged(plugin)} title={plugin.name}>
        <div className="viz-picker__item-name">{plugin.name}</div>
        <img className="viz-picker__item-img" src={plugin.info.logos.small} />
      </div>
    );
  };

  componentDidMount() {
    setTimeout(() => {
      this.searchInput.focus();
    }, 300);
  }

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
