// Libraries
import React, { Component } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';

// Types
import { StoreState } from 'app/types';
import { importAppPlugin } from './plugin_loader';
import { AppPlugin } from '@grafana/ui';
import { getPluginSettings } from './PluginSettingsCache';

interface Props {
  pluginId: string; // From the angular router
}

interface State {
  loading: boolean;
  notFound: boolean;
  app?: AppPlugin;
}

export class AppPage extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      notFound: false,
      loading: true,
    };
    console.log('Constructor', this.props);
  }

  componentDidMount() {
    console.log('DID Mount', this.props);
    this.loadApp();
  }

  componentDidUpdate(prevProps: Props) {
    console.log('update?');

    if (this.props.pluginId !== prevProps.pluginId) {
      console.log('Change the APP'); // does not really happen since it reloads
      //  this.loadApp();
    }
  }

  async loadApp() {
    const { pluginId } = this.props;

    this.setState({ loading: true });
    const info = await getPluginSettings(pluginId);
    if (!info || info.type !== 'app' || !info.enabled) {
      this.setState({ loading: false, notFound: true, app: null });
      return;
    }

    importAppPlugin(info)
      .then(app => {
        this.setState({ loading: false, notFound: false, app });
      })
      .catch(err => {
        this.setState({ loading: false, notFound: true, app: null });
      });
  }

  render() {
    const { pluginId } = this.props;
    const { app } = this.state;

    // if (notFound) {
    //   return <div className="alert alert-error">Panel with id {urlPanelId} not found</div>;
    // }

    console.log('APP:', app);

    return (
      <div>
        APP: {pluginId}
        <br />
        <ul>
          <li>
            <a href="/a/xxx/yyy">XXX</a>
          </li>
          <li>
            <a href="/a/xxx/BBB">BBB</a>
          </li>
          <li>
            <a href="/a/ccc/BBB">CCC</a>
          </li>
          <li>
            <a href="/a/ccc/BBB?aaa">with param</a>
          </li>
        </ul>
        <br />
      </div>
    );
  }
}

const mapStateToProps = (state: StoreState) => ({
  pluginId: state.location.routeParams.pluginId,
});

const mapDispatchToProps = {
  // initDashboard,
};

export default hot(module)(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(AppPage)
);
