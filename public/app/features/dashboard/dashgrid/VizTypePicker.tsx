import React, { PureComponent } from 'react';
import classNames from 'classnames';
import _ from 'lodash';

import { FadeIn } from 'app/core/components/Animations/FadeIn';
import config from 'app/core/config';
import { PanelPlugin } from 'app/types/plugins';

interface Props {
  current: PanelPlugin;
  onTypeChanged: (newType: PanelPlugin) => void;
}

interface State {
  pluginList: PanelPlugin[];
  isOpen: boolean;
}

export class VizTypePicker extends PureComponent<Props, State> {
  constructor(props) {
    super(props);

    this.state = {
      pluginList: this.getPanelPlugins(''),
      isOpen: false,
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

  renderFilters() {
    return (
      <>
        <label className="gf-form--has-input-icon">
          <input type="text" className="gf-form-input width-13" placeholder="" />
          <i className="gf-form-input-icon fa fa-search" />
        </label>
        <div className="p-l-1">
          <button className="btn toggle-btn gf-form-btn active">Basic Types</button>
          <button className="btn toggle-btn gf-form-btn">Master Types</button>
        </div>
      </>
    );
  }

  onToggleOpen = () => {
    this.setState({ isOpen: !this.state.isOpen });
  };

  render() {
    const { current } = this.props;
    const { pluginList, isOpen } = this.state;

    return (
      <div className="viz-picker">
        <div className="viz-picker__bar">
          <div className="gf-form-inline">
            <div className="gf-form">
              <label className="gf-form-label">Visualization</label>
              <label className="gf-form-input width-10" onClick={this.onToggleOpen}>
                <span>{current.name}</span>
                {isOpen && <i className="fa fa-caret-down pull-right" />}
                {!isOpen && <i className="fa fa-caret-left pull-right" />}
              </label>
            </div>
            <div className="gf-form gf-form--grow">
              <label className="gf-form-label gf-form-label--grow" />
            </div>
            <div className="gf-form">
              <label className="gf-form-label">
                <i className="fa fa-caret-down" /> Help
              </label>
            </div>
          </div>
        </div>

        <FadeIn in={isOpen} duration={300}>
          <div className="cta-form">
            <button className="cta-form__close" onClick={this.onToggleOpen}>
              <i className="fa fa-remove" />
            </button>

            <div className="cta-form__bar">
              <div className="cta-form__bar-header">Select visualization</div>
              {this.renderFilters()}
              <div className="gf-form--grow" />
            </div>

            <div className="viz-picker__items">{pluginList.map(this.renderVizPlugin)}</div>
          </div>
        </FadeIn>
      </div>
    );
  }
}
