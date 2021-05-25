import React, { Component } from 'react';
import { connect } from 'react-redux';
import { ExploreId, ExploreQueryParams } from 'app/types/explore';
import { ErrorBoundaryAlert } from '@grafana/ui';
import { lastSavedUrl, resetExploreAction, richHistoryUpdatedAction } from './state/main';
import { getRichHistory } from '../../core/utils/richHistory';
import { ExplorePaneContainer } from './ExplorePaneContainer';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { NavModel } from '@grafana/data';
import { Branding } from '../../core/components/Branding/Branding';

// Libraries
import { getNavModel, getTitleFromNavModel } from '../../core/selectors/navModel';

// Types
import { StoreState } from 'app/types';

export interface WrapperProps extends GrafanaRouteComponentProps<{}, ExploreQueryParams> {
  resetExploreAction: typeof resetExploreAction;
  richHistoryUpdatedAction: typeof richHistoryUpdatedAction;
  navModel: NavModel;
}

export class Wrapper extends Component<WrapperProps> {
  updatePageDocumentTitle(navModel: NavModel) {
    // update document title
    if (navModel) {
      const title = getTitleFromNavModel(navModel);
      document.title = title ? `${title} - ${Branding.AppTitle}` : Branding.AppTitle;
    } else {
      document.title = Branding.AppTitle;
    }
  }

  componentWillUnmount() {
    this.props.resetExploreAction({});
  }

  componentDidMount() {
    lastSavedUrl.left = undefined;
    lastSavedUrl.right = undefined;

    const richHistory = getRichHistory();
    this.props.richHistoryUpdatedAction({ richHistory });
    this.updatePageDocumentTitle(this.props.navModel);
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

function mapStateToProps(state: StoreState) {
  return {
    navModel: getNavModel(state.navIndex, 'explore'),
  };
}

const mapDispatchToProps = {
  resetExploreAction,
  richHistoryUpdatedAction,
};

export default connect(mapStateToProps, mapDispatchToProps)(Wrapper);
