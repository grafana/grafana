import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { StoreState } from 'app/types';
import { getNavModel } from 'app/core/selectors/navModel';
import Page from 'app/core/components/Page/Page';
import { NavModel } from '@grafana/data';

import Centrifuge, { PublicationContext } from 'centrifuge/dist/centrifuge.protobuf';
import SockJS from 'sockjs-client';

const centrifuge = new Centrifuge('http://localhost:3000/live/sockjs', {
  debug: true,
  sockjs: SockJS,
});

centrifuge.setToken('ABCD');

centrifuge.on('connect', function(context) {
  console.log('CONNECT', context);
});

centrifuge.on('disconnect', function(context) {
  console.log('disconnect', context);
});

// Server side function
centrifuge.on('publish', function(ctx) {
  console.log('Publication from server-side channel', ctx);
});

let sub: any = false;

interface Props {
  navModel: NavModel;
}

interface State {
  // TODO
}

export class LiveAdmin extends PureComponent<Props, State> {
  state: State = {};

  componentDidMount = () => {
    if (!sub) {
      centrifuge.connect();
      sub = centrifuge.subscribe('example', (message: PublicationContext) => {
        console.log('GOT', message);
      });
    }
  };

  render() {
    const { navModel } = this.props;

    return (
      <Page navModel={navModel}>
        <Page.Contents>
          TODO... show channels
          <br />
          more
          <br />
        </Page.Contents>
      </Page>
    );
  }
}

const mapStateToProps = (state: StoreState) => ({
  navModel: getNavModel(state.navIndex, 'live'),
});

export default hot(module)(connect(mapStateToProps)(LiveAdmin));
