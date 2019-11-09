import React from 'react';
import { connect } from 'react-redux';

import { ExploreId, ExploreItemState, StoreState } from 'app/types';

import Explore from './Explore';
import { splitClose } from './state/actions';

type SplitPaneOuterProps = {
  exploreId: ExploreId;
};

type SplitPaneProps = SplitPaneOuterProps & {
  externalUrl?: string;
  closeSplit: typeof splitClose;
};

function UnconnectedSplitPane(props: SplitPaneProps) {
  const { externalUrl, exploreId, closeSplit } = props;
  if (externalUrl) {
    return (
      <div className={'explore explore-split'}>
        <div className={'explore-toolbar splitted'}>
          <div className="explore-toolbar-item">
            <div className="explore-toolbar-header">
              <a className="explore-toolbar-header-close" onClick={() => closeSplit(exploreId)}>
                <i className="fa fa-times fa-fw" />
              </a>
            </div>
          </div>
        </div>
        <iframe style={{ border: 'none' }} width={'100%'} height={'100%'} src={externalUrl} />;
      </div>
    );
  } else {
    return <Explore exploreId={exploreId} />;
  }
}

const mapStateToProps = (state: StoreState, props: SplitPaneOuterProps) => {
  const exploreItem: ExploreItemState = state.explore[props.exploreId] as any;
  return {
    externalUrl: exploreItem.externalUrl,
  };
};

const mapDispatchToProps = {
  closeSplit: splitClose,
};

export const SplitPane = connect(mapStateToProps, mapDispatchToProps)(UnconnectedSplitPane);
