import React, { PureComponent } from 'react';
import { connect, MapStateToProps } from 'react-redux';
import { NavModel } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Icon } from '@grafana/ui';
import Page from '../Page/Page';
import { getNavModel } from 'app/core/selectors/navModel';
import { StoreState } from 'app/types';

interface ConnectedProps {
  navModel: NavModel;
}

interface OwnProps {}

type Props = ConnectedProps;

export class ErrorPage extends PureComponent<Props> {
  render() {
    const { navModel } = this.props;
    return (
      <Page navModel={navModel}>
        <Page.Contents>
          <div className="page-container page-body">
            <div className="panel-container error-container">
              <div className="error-column graph-box">
                <div className="error-row">
                  <div className="error-column error-space-between graph-percentage">
                    <p>100%</p>
                    <p>80%</p>
                    <p>60%</p>
                    <p>40%</p>
                    <p>20%</p>
                    <p>0%</p>
                  </div>
                  <div className="error-column image-box">
                    <img src="public/img/line-graph-graph-svgrepo-com.svg" width="100%" alt="graph" />
                    <div className="error-row error-space-between">
                      <p className="graph-text">Then</p>
                      <p className="graph-text">Now</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="error-column info-box">
                <div className="error-row current-box">
                  <p className="current-text">current</p>
                </div>
                <div className="error-row" style={{ flex: 1 }}>
                  <Icon name="minus-circle" className="error-minus" />
                  <div className="error-column error-space-between error-full-width">
                    <div className="error-row error-space-between">
                      <p>Chances you are on the page you are looking for.</p>
                      <p className="left-margin">0%</p>
                    </div>
                    <div>
                      <h3>Sorry for the inconvenience</h3>
                      <p>
                        Please go back to your{' '}
                        <a href={config.appSubUrl} className="error-link">
                          home dashboard
                        </a>{' '}
                        and try again.
                      </p>
                      <p>
                        If the error persists, seek help on the{' '}
                        <a href="https://community.grafana.com" target="_blank" className="error-link">
                          community site
                        </a>
                        .
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Page.Contents>
      </Page>
    );
  }
}

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = state => {
  return {
    navModel: getNavModel(state.navIndex, 'not-found'),
  };
};

export default connect(mapStateToProps)(ErrorPage);
