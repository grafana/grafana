import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { ExploreId, ExploreQueryParams } from 'app/types/explore';
import { ErrorBoundaryAlert } from '@grafana/ui';
import {
  AUTO_LOAD_LOGS_VOLUME_SETTING_KEY,
  lastSavedUrl,
  resetExploreAction,
  richHistoryUpdatedAction,
  storeAutoLoadLogsVolumeAction,
} from './state/main';
import { getRichHistory } from '../../core/utils/richHistory';
import { ExplorePaneContainer } from './ExplorePaneContainer';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { Branding } from '../../core/components/Branding/Branding';

import { getNavModel } from '../../core/selectors/navModel';
import { StoreState } from 'app/types';
import store from '../../core/store';

interface RouteProps extends GrafanaRouteComponentProps<{}, ExploreQueryParams> {}
interface OwnProps {}

const mapStateToProps = (state: StoreState) => {
  return {
    navModel: getNavModel(state.navIndex, 'explore'),
    exploreState: state.explore,
    autoLoadLogsVolume: state.explore.autoLoadLogsVolume,
  };
};

const mapDispatchToProps = {
  resetExploreAction,
  richHistoryUpdatedAction,
  storeAutoLoadLogsVolumeAction,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

type Props = OwnProps & RouteProps & ConnectedProps<typeof connector>;
class WrapperUnconnected extends PureComponent<Props> {
  componentWillUnmount() {
    this.props.resetExploreAction({});
  }

  componentDidMount() {
    lastSavedUrl.left = undefined;
    lastSavedUrl.right = undefined;

    const richHistory = getRichHistory();
    this.props.richHistoryUpdatedAction({ richHistory });
  }

  componentDidUpdate(prevProps: Props) {
    const { autoLoadLogsVolume } = this.props;
    const { left, right } = this.props.queryParams;
    const hasSplit = Boolean(left) && Boolean(right);
    const datasourceTitle = hasSplit
      ? `${this.props.exploreState.left.datasourceInstance?.name} | ${this.props.exploreState.right?.datasourceInstance?.name}`
      : `${this.props.exploreState.left.datasourceInstance?.name}`;
    const documentTitle = `${this.props.navModel.main.text} - ${datasourceTitle} - ${Branding.AppTitle}`;
    document.title = documentTitle;

    if (prevProps.autoLoadLogsVolume !== autoLoadLogsVolume) {
      store.set(AUTO_LOAD_LOGS_VOLUME_SETTING_KEY, autoLoadLogsVolume);
    }
  }

  render() {
    const { left, right } = this.props.queryParams;
    const hasSplit = Boolean(left) && Boolean(right);

    return (
      <div className="page-scrollbar-wrapper">
        <div className="explore-wrapper">
          <ErrorBoundaryAlert style="page">
            <ExplorePaneContainer split={hasSplit} exploreId={ExploreId.left} urlQuery={left} />
          </ErrorBoundaryAlert>
          {hasSplit && (
            <ErrorBoundaryAlert style="page">
              <ExplorePaneContainer split={hasSplit} exploreId={ExploreId.right} urlQuery={right} />
            </ErrorBoundaryAlert>
          )}
        </div>
      </div>
    );
  }
}

const Wrapper = connector(WrapperUnconnected);

export default Wrapper;
