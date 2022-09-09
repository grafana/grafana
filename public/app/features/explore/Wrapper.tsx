import { css } from '@emotion/css';
import { inRange } from 'lodash';
import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { locationService } from '@grafana/runtime';
import { ErrorBoundaryAlert } from '@grafana/ui';
import { SplitView } from 'app/core/components/SplitPaneWrapper/SplitView';
import { GrafanaContext } from 'app/core/context/GrafanaContext';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { StoreState } from 'app/types';
import { ExploreId, ExploreQueryParams } from 'app/types/explore';

import { Branding } from '../../core/components/Branding/Branding';
import { getNavModel } from '../../core/selectors/navModel';

import { ExploreActions } from './ExploreActions';
import { ExplorePaneContainer } from './ExplorePaneContainer';
import {
  lastSavedUrl,
  resetExploreAction,
  richHistoryUpdatedAction,
  cleanupPaneAction,
  changeLargerPane,
  evenResizePane,
} from './state/main';

const styles = {
  pageScrollbarWrapper: css`
    width: 100%;
    flex-grow: 1;
    min-height: 0;
  `,
  exploreWrapper: css`
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
  changeLargerPane,
  evenResizePane,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

type Props = OwnProps & RouteProps & ConnectedProps<typeof connector>;
class WrapperUnconnected extends PureComponent<Props> {
  minWidth = 200;
  static contextType = GrafanaContext;

  componentWillUnmount() {
    console.log('wrapper unmount');
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
    console.log('wrapper mount');
    //This is needed for breadcrumbs and topnav.
    //We should probably abstract this out at some point
    this.context.chrome.update({ sectionNav: this.props.navModel.node });

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
  }

  componentDidUpdate(prevProps: Props) {
    if (JSON.stringify(prevProps.exploreState) !== JSON.stringify(this.props.exploreState)) {
      const { left, right } = this.props.queryParams;
      const hasSplit = Boolean(left) && Boolean(right);
      // in the update before the error, the only thing that changes is the location key.
      //console.log('wrapper update', JSON.stringify(prevProps));
      //console.log('wrapper update2', JSON.stringify(this.props));
      const datasourceTitle = hasSplit
        ? `${this.props.exploreState.left.datasourceInstance?.name} | ${this.props.exploreState.right?.datasourceInstance?.name}`
        : `${this.props.exploreState.left.datasourceInstance?.name}`;
      const documentTitle = `${this.props.navModel.main.text} - ${datasourceTitle} - ${Branding.AppTitle}`;
      document.title = documentTitle;
    }
  }

  updateSplitSize(rightSplitWidth: number) {
    const evenSplitWidth = window.innerWidth / 2;
    const areBothSimilar = inRange(rightSplitWidth, evenSplitWidth - 100, evenSplitWidth + 100);
    if (areBothSimilar) {
      this.props.changeLargerPane(undefined);
    } else {
      this.props.changeLargerPane(rightSplitWidth > evenSplitWidth ? ExploreId.right : ExploreId.left);
    }
  }

  render() {
    const { left, right } = this.props.queryParams;
    const { maxedExploreId, evenSplitPanes } = this.props.exploreState;
    const hasSplit = Boolean(left) && Boolean(right);
    let widthCalc = 0;

    if (hasSplit) {
      if (!evenSplitPanes && maxedExploreId) {
        widthCalc = maxedExploreId === ExploreId.right ? window.innerWidth - this.minWidth : this.minWidth;
      } else {
        widthCalc = window.innerWidth / 2;
      }
    }

    const splitSizeObj = { rightPaneSize: widthCalc };

    const leftPane = (
      <ErrorBoundaryAlert style="page">
        <ExplorePaneContainer split={hasSplit} exploreId={ExploreId.left} urlQuery={left} />
      </ErrorBoundaryAlert>
    );

    return (
      <div className={styles.pageScrollbarWrapper}>
        <ExploreActions exploreIdLeft={ExploreId.left} exploreIdRight={ExploreId.right} />
        <div className={styles.exploreWrapper}>
          <SplitView
            uiState={splitSizeObj}
            minSize={this.minWidth}
            onResize={(width: number) => {
              this.updateSplitSize(width);
            }}
          >
            {leftPane}
            {hasSplit && (
              <ErrorBoundaryAlert style="page">
                <ExplorePaneContainer split={hasSplit} exploreId={ExploreId.right} urlQuery={right} />
              </ErrorBoundaryAlert>
            )}
          </SplitView>
        </div>
      </div>
    );
  }
}

const Wrapper = connector(WrapperUnconnected);

export default Wrapper;
