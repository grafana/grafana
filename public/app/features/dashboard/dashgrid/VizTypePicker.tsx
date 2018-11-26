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
  pluginList: PanelPlugin[];
}

export class VizTypePicker extends PureComponent<Props, State> {
  searchInput: HTMLElement;

  constructor(props) {
    super(props);

    this.state = {
      pluginList: this.getPanelPlugins(''),
    };
  }

  getPanelPlugins(filter) {
    const panels = _.chain(config.panels)
      .filter({ hideFromList: false })
      .map(item => item)
      .value();

    // add sort by sort property
    return _.sortBy(panels, 'sort');
  }

  renderVizPlugin = (plugin, index) => {
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

  renderFilters() {
    return (
      <>
        <label className="gf-form--has-input-icon">
          <input
            type="text"
            className="gf-form-input width-13"
            placeholder=""
            ref={elem => (this.searchInput = elem)}
          />
          <i className="gf-form-input-icon fa fa-search" />
        </label>
      </>
    );
  }

  render() {
    const { pluginList } = this.state;

    return (
      <>
        <div className="cta-form__bar">
          {this.renderFilters()}
          <div className="gf-form--grow" />
        </div>

        <div className="viz-picker">{pluginList.map(this.renderVizPlugin)}</div>
      </>
    );
  }
}
