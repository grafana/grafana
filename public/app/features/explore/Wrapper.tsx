import { css } from '@emotion/css';
import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { locationService } from '@grafana/runtime';
import { ErrorBoundaryAlert } from '@grafana/ui';
import { SplitPaneWrapper } from 'app/core/components/SplitPaneWrapper/SplitPaneWrapper';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { StoreState } from 'app/types';
import { ExploreId, ExploreQueryParams } from 'app/types/explore';

import { Branding } from '../../core/components/Branding/Branding';
import { getNavModel } from '../../core/selectors/navModel';

import { ExploreActions } from './ExploreActions';
import { ExplorePaneContainer } from './ExplorePaneContainer';
import { changeSize } from './state/explorePane';
import { lastSavedUrl, resetExploreAction, richHistoryUpdatedAction, cleanupPaneAction } from './state/main';

const styles = {
  pageScrollbarWrapper: css`
    width: 100%;
    flex-grow: 1;
    min-height: 0;
  `,
  exploreWrapper: css`
    overflow: scroll;
    display: flex;
    height: 100%;
  `,
};

interface RouteProps extends GrafanaRouteComponentProps<{}, ExploreQueryParams> {}
interface OwnProps {}

const mapStateToProps = (state: StoreState) => {
  return {
    navModel: getNavModel(state.navIndex, 'explore'),
    exploreState: state.explore,
  };
};

const mapDispatchToProps = {
  resetExploreAction,
  richHistoryUpdatedAction,
  cleanupPaneAction,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

type Props = OwnProps & RouteProps & ConnectedProps<typeof connector>;
class WrapperUnconnected extends PureComponent<Props> {
  componentWillUnmount() {
    const { left, right } = this.props.queryParams;

    if (Boolean(left)) {
      cleanupPaneAction({ exploreId: ExploreId.left });
    }

    if (Boolean(right)) {
      cleanupPaneAction({ exploreId: ExploreId.right });
    }

    this.props.resetExploreAction({});
  }

  componentDidMount() {
    lastSavedUrl.left = undefined;
    lastSavedUrl.right = undefined;

    // timeSrv (which is used internally) on init reads `from` and `to` param from the URL and updates itself
    // using those value regardless of what is passed to the init method.
    // The updated value is then used by Explore to get the range for each pane.
    // This means that if `from` and `to` parameters are present in the URL,
    // it would be impossible to change the time range in Explore.
    // We are only doing this on mount for 2 reasons:
    // 1: Doing it on update means we'll enter a render loop.
    // 2: when parsing time in Explore (before feeding it to timeSrv) we make sure `from` is before `to` inside
    //    each pane state in order to not trigger un URL update from timeSrv.
    const searchParams = locationService.getSearchObject();
    if (searchParams.from || searchParams.to) {
      locationService.partial({ from: undefined, to: undefined }, true);
    }

    if (this.props.exploreState[ExploreId.right]?.containerWidth === undefined) {
      const { left, right } = this.props.queryParams;
      const hasSplit = Boolean(left) && Boolean(right);
      changeSize(ExploreId.left, {
        height: window.innerHeight,
        width: hasSplit ? window.innerWidth / 2 : window.innerWidth,
      });
      if (hasSplit) {
        changeSize(ExploreId.right, { height: window.innerHeight, width: window.innerWidth / 2 });
      }
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { left, right } = this.props.queryParams;
    const hasSplit = Boolean(left) && Boolean(right);
    const datasourceTitle = hasSplit
      ? `${this.props.exploreState.left.datasourceInstance?.name} | ${this.props.exploreState.right?.datasourceInstance?.name}`
      : `${this.props.exploreState.left.datasourceInstance?.name}`;
    const documentTitle = `${this.props.navModel.main.text} - ${datasourceTitle} - ${Branding.AppTitle}`;
    document.title = documentTitle;
  }

  render() {
    const { left, right } = this.props.queryParams;
    const hasSplit = Boolean(left) && Boolean(right);
    const rightContainerWidth = this.props.exploreState[ExploreId.right]?.containerWidth || window.innerWidth / 2;
    const minPaneSize = 100;

    return (
      <div className={styles.pageScrollbarWrapper}>
        <ExploreActions exploreIdLeft={ExploreId.left} exploreIdRight={ExploreId.right} />
        <div className={styles.exploreWrapper}>
          <SplitPaneWrapper
            topPaneVisible={false}
            minVerticalPaneWidth={minPaneSize}
            leftPaneComponents={
              <ErrorBoundaryAlert style="page" key="left">
                <ExplorePaneContainer key="leftContainer" exploreId={ExploreId.left} urlQuery={left} />
              </ErrorBoundaryAlert>
            }
            rightPaneComponents={
              <ErrorBoundaryAlert style="page" key="right">
                <ExplorePaneContainer key="rightContainer" exploreId={ExploreId.right} urlQuery={right} />
              </ErrorBoundaryAlert>
            }
            uiState={{ topPaneSize: 0, rightPaneSize: rightContainerWidth }}
            rightPaneVisible={hasSplit}
            updateUiState={() => {
              /* handled by changeSizeAction */
            }}
          />
        </div>
      </div>
    );
  }
}

const Wrapper = connector(WrapperUnconnected);

export default Wrapper;
