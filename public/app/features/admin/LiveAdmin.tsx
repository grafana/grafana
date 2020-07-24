import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { StoreState } from 'app/types';
import { getNavModel } from 'app/core/selectors/navModel';
import Page from 'app/core/components/Page/Page';
import { NavModel } from '@grafana/data';
import { Unsubscribable, PartialObserver } from 'rxjs';
import { getGrafanaLiveSrv } from '@grafana/runtime';

interface Props {
  navModel: NavModel;
}

interface State {
  connected: boolean;
  count: number;
  lastTime: number;
  lastBody: string;
}

export class LiveAdmin extends PureComponent<Props, State> {
  state: State = {
    connected: false,
    count: 0,
    lastTime: 0,
    lastBody: '',
  };
  subscription?: Unsubscribable;

  observer: PartialObserver<any> = {
    next: (msg: any) => {
      this.setState({
        count: this.state.count + 1,
        lastTime: Date.now(),
        lastBody: JSON.stringify(msg),
      });
    },
  };

  startSubscriptoin = () => {
    const srv = getGrafanaLiveSrv();
    if (srv.isConnected()) {
      this.subscription = getGrafanaLiveSrv().subscribe<any>('example', this.observer);
      this.setState({ connected: true });
      return;
    }
    console.log('Not yet connected... try again...');
    setTimeout(this.startSubscriptoin, 200);
  };

  componentDidMount = () => {
    this.startSubscriptoin();
  };

  componentWillUnmount() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  render() {
    const { navModel } = this.props;
    const { lastBody, lastTime, count } = this.state;

    return (
      <Page navModel={navModel}>
        <Page.Contents>
          <h3>Last message on channel: example ({count})</h3>
          {lastTime > 1 && (
            <div>
              <b>{lastTime}</b>
              <pre>{lastBody}</pre>
            </div>
          )}
        </Page.Contents>
      </Page>
    );
  }
}

const mapStateToProps = (state: StoreState) => ({
  navModel: getNavModel(state.navIndex, 'live'),
});

export default hot(module)(connect(mapStateToProps)(LiveAdmin));
