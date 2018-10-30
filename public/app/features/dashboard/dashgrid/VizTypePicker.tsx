import React, { PureComponent } from 'react';
import classNames from 'classnames';
import config from 'app/core/config';
import { PanelPlugin } from 'app/types/plugins';
import CustomScrollbar from 'app/core/components/CustomScrollbar/CustomScrollbar';
import _ from 'lodash';

interface Props {
  currentType: string;
  onTypeChanged: (newType: PanelPlugin) => void;
}

interface State {
  pluginList: PanelPlugin[];
}

export class VizTypePicker extends PureComponent<Props, State> {
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
      'viz-picker__item--selected': plugin.id === this.props.currentType,
    });

    return (
      <div key={index} className={cssClass} onClick={() => this.props.onTypeChanged(plugin)} title={plugin.name}>
        <img className="viz-picker__item-img" src={plugin.info.logos.small} />
        <div className="viz-picker__item-name">{plugin.name}</div>
      </div>
    );
  };

  render() {
    return (
      <div className="viz-picker">
        <div className="viz-picker__search">
          <div className="gf-form gf-form--grow">
            <label className="gf-form--has-input-icon gf-form--grow">
              <input type="text" className="gf-form-input" placeholder="Search type" />
              <i className="gf-form-input-icon fa fa-search" />
            </label>
          </div>
        </div>
        <div className="viz-picker__items">
          <CustomScrollbar>
            <div className="scroll-margin-helper">{this.state.pluginList.map(this.renderVizPlugin)}</div>
          </CustomScrollbar>
        </div>
      </div>
    );
  }
}
