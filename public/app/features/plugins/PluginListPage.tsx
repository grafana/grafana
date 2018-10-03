import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import PageHeader from '../../core/components/PageHeader/PageHeader';
import PluginActionBar from './PluginActionBar';
import PluginList from './PluginList';
import { NavModel, Plugin } from '../../types';
import { loadPlugins } from './state/actions';
import { getNavModel } from '../../core/selectors/navModel';
import { getLayoutMode, getPlugins } from './state/selectors';
import { LayoutMode } from '../../core/components/LayoutSelector/LayoutSelector';

export interface Props {
  navModel: NavModel;
  plugins: Plugin[];
  layoutMode: LayoutMode;
  loadPlugins: typeof loadPlugins;
}

export class PluginListPage extends PureComponent<Props> {
  componentDidMount() {
    this.fetchPlugins();
  }

  async fetchPlugins() {
    await this.props.loadPlugins();
  }

  render() {
    const { navModel, plugins, layoutMode } = this.props;

    return (
      <div>
        <PageHeader model={navModel} />
        <div className="page-container page-body">
          <PluginActionBar />
          {plugins && <PluginList plugins={plugins} layoutMode={layoutMode} />}
        </div>
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    navModel: getNavModel(state.navIndex, 'plugins'),
    plugins: getPlugins(state.plugins),
    layoutMode: getLayoutMode(state.plugins),
  };
}

const mapDispatchToProps = {
  loadPlugins,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(PluginListPage));
