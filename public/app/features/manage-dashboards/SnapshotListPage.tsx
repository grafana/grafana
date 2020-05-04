import React, { PureComponent } from 'react';
import { MapStateToProps, connect } from 'react-redux';
import { NavModel } from '@grafana/data';
import Page from 'app/core/components/Page/Page';
import { getUrl } from 'app/core/selectors/location';
import { getNavModel } from 'app/core/selectors/navModel';
import { StoreState } from 'app/types';
import { SnapshotListTable } from './components/SnapshotListTable';

interface Props {
  navModel: NavModel;
  url: string;
}

interface State {
  navModel?: NavModel;
}

class SnapshotListPage extends PureComponent<Props, State> {
  state: State = {
    navModel: undefined,
  };

  constructor(props: Props) {
    super(props);
    this.state.navModel = this.getNav(props.navModel, props.url);
  }

  getNav(nav: NavModel, url: string): NavModel {
    const node = nav.main.children?.find(item => item.url === url);
    if (node) {
      nav.node = node;
    }

    for (const item of nav.main.children) {
      item.active = false;

      if (item.url === nav.node.url) {
        item.active = true;
      }
    }

    return nav;
  }

  render() {
    const { url } = this.props;
    return (
      <Page navModel={this.state.navModel}>
        <Page.Contents>
          <SnapshotListTable url={url} />
        </Page.Contents>
      </Page>
    );
  }
}

const mapStateToProps: MapStateToProps<Props, {}, StoreState> = (state: StoreState) => ({
  navModel: getNavModel(state.navIndex, 'dashboards'),
  url: getUrl(state.location),
});

export default connect(mapStateToProps)(SnapshotListPage);
