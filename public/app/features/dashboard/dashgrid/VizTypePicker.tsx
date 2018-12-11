import React, { PureComponent } from 'react';
import _ from 'lodash';

import config from 'app/core/config';
import { PanelPlugin } from 'app/types/plugins';
import VizTypePickerPlugin from './VizTypePickerPlugin';
import withKeyboardNavigation, { KeyboardNavigationProps } from './withKeyboardNavigation';

export interface Props {
  current: PanelPlugin;
  onTypeChanged: (newType: PanelPlugin) => void;
}

interface State {
  searchQuery: string;
}

export const VizTypePicker = withKeyboardNavigation(
  class VizTypePicker extends PureComponent<Props & KeyboardNavigationProps, State> {
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

    renderVizPlugin = (plugin: PanelPlugin, index: number) => {
      const { onTypeChanged, selected, onMouseEnter } = this.props;
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

    renderFilters = () => {
      const { searchQuery } = this.state;
      const { onKeyDown } = this.props;
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
              // onKeyDown={this.props.onKeyDown}
              onKeyDown={evt => {
                onKeyDown(evt, this.maxSelectedIndex, () => {
                  const { onTypeChanged, selected } = this.props;
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
);
