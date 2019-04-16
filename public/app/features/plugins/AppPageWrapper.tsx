// Libraries
import React, { Component } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';

// Types
import { StoreState, NavModel, UrlQueryMap } from 'app/types';

import Page from 'app/core/components/Page/Page';

interface Props {
  pluginId: string; // From the angular router
  path?: string;
  query: UrlQueryMap;
}

import { State, loadAppPluginForPage } from './AppConfigPage';

class AppPageWrapper extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      loading: true,
    };
  }

  async componentDidMount() {
    const { pluginId } = this.props;
    this.setState(await loadAppPluginForPage(pluginId));
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.query !== prevProps.query) {
      console.log('QUERY changed', this.props.query);
    }
  }

  getNavModel(): NavModel {
    const { loading, plugin } = this.state;
    if (plugin) {
      const node = {
        text: 'TODO Get the nav model from the application',
        icon: 'fa fa-fw fa-info',
        subTitle: 'The App subtitle',
      };
      return {
        node: node,
        main: node,
      };
    }
    const item = loading
      ? {
          text: 'Loading',
          icon: 'fa fa-fw fa-spinner fa-spin',
        }
      : {
          text: 'Unkown App Plugin',
          icon: 'fa fa-fw fa-warning',
          subTitle: '404 Error',
        };
    return {
      node: item,
      main: item,
    };

    // getNotFoundNav() {
    // }

    // const item:NavModelItem = {
    //   text: 'Hello',
    //   subTitle: 'XXXXXX',
    //   url: '',
    //   id: 'xxx',
    //   icon: 'fa fa-help',
    //   active: true,
    //   children: [],
    // };

    // const main:NavModelItem = {
    //   hideFromTabs: true,
    //   icon: "gicon gicon-shield",
    //   id: "admin",
    //   text: "Server Admin",
    //   subTitle: 'XXXXXX',
    //   url: "/admin/users",
    //   children: [item],
    // }

    // return {
    //   main: main,
    //   node: item,
    // };
  }

  onNavChanged = (nav: any) => {
    console.log('TODO, update the nav from the page control', nav);
  };

  renderPageBody() {
    const { path, query } = this.props;
    const { plugin } = this.state;
    const { pages } = plugin;
    if (pages) {
      for (const page of pages) {
        if (!page.pathPrefix || (path && path.startsWith(page.pathPrefix))) {
          console.log('LOAD', page);

          return <page.body plugin={plugin} query={query} onNavChanged={this.onNavChanged} url={'xxxxx'} />;
        }
      }
    }
    return null;
  }

  render() {
    const { pluginId, path } = this.props;
    const { loading, plugin } = this.state;

    return (
      <Page navModel={this.getNavModel()}>
        <Page.Contents isLoading={loading}>
          {!loading && (
            <div>
              {plugin ? (
                <div>
                  HELLO: {pluginId} / {path}
                  <ul>
                    <li>
                      <a href="/a/example-app/page?x=1">111</a>
                    </li>
                    <li>
                      <a href="/a/example-app/page?x=2">222</a>
                    </li>
                    <li>
                      <a href="/a/example-app/page?x=3">333</a>
                    </li>
                  </ul>
                  {this.renderPageBody()}
                </div>
              ) : (
                <div>not found...</div>
              )}
            </div>
          )}
        </Page.Contents>
      </Page>
    );
  }
}

const mapStateToProps = (state: StoreState) => ({
  pluginId: state.location.routeParams.pluginId,
  path: state.location.routeParams.path,
  query: state.location.query,
});

export default hot(module)(connect(mapStateToProps)(AppPageWrapper));
