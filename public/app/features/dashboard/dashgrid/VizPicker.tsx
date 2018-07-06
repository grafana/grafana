import React, { PureComponent } from 'react';
import config from 'app/core/config';
import _ from 'lodash';

interface Props {}

interface State {
  pluginList: any[];
}

export class VizPicker extends PureComponent<Props, State> {
  constructor(props) {
    super(props);

    this.state = {
      pluginList: this.getPanelPlugins(''),
    };
  }

  getPanelPlugins(filter) {
    let panels = _.chain(config.panels)
      .filter({ hideFromList: false })
      .map(item => item)
      .value();

    // add sort by sort property
    return _.sortBy(panels, 'sort');
  }

  onChangeVizPlugin = plugin => {
    console.log('set viz');
  };

  renderVizPlugin(plugin, index) {
    return (
      <div key={index} className="viz-picker__item" onClick={() => this.onChangeVizPlugin(plugin)} title={plugin.name}>
        <img className="viz-picker__item__img" src={plugin.info.logos.small} />
        <div className="viz-pikcer__item__name">{plugin.name}</div>
      </div>
    );
  }

  render() {
    return <div className="viz-picker">{this.state.pluginList.map(this.renderVizPlugin)}</div>;
  }
}
