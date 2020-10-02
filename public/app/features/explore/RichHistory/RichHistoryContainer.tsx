// Libraries
import React, { useState } from 'react';
import { connect } from 'react-redux';
import { hot } from 'react-hot-loader';

// Services & Utils
import store from 'app/core/store';
import { RICH_HISTORY_SETTING_KEYS } from 'app/core/utils/richHistory';

// Types
import { StoreState } from 'app/types';
import { ExploreId, RichHistoryQuery } from 'app/types/explore';

// Components, enums
import { RichHistory, Tabs } from './RichHistory';

//Actions
import { deleteRichHistory } from '../state/actions';
import { ExploreDrawer } from '../ExploreDrawer';

export interface Props {
  width: number;
  exploreId: ExploreId;
  activeDatasourceInstance: string;
  richHistory: RichHistoryQuery[];
  firstTab: Tabs;
  deleteRichHistory: typeof deleteRichHistory;
  onClose: () => void;
}

export function RichHistoryContainer(props: Props) {
  const [height, setHeight] = useState(400);

  const { richHistory, width, firstTab, activeDatasourceInstance, exploreId, deleteRichHistory, onClose } = props;

  return (
    <ExploreDrawer
      width={width}
      onResize={(_e, _dir, ref) => {
        setHeight(Number(ref.style.height.slice(0, -2)));
      }}
    >
      <RichHistory
        richHistory={richHistory}
        firstTab={firstTab}
        activeDatasourceInstance={activeDatasourceInstance}
        exploreId={exploreId}
        deleteRichHistory={deleteRichHistory}
        onClose={onClose}
        height={height}
      />
    </ExploreDrawer>
  );
}

function mapStateToProps(state: StoreState, { exploreId }: { exploreId: ExploreId }) {
  const explore = state.explore;
  // @ts-ignore
  const item: ExploreItemState = explore[exploreId];
  const { datasourceInstance } = item;
  const firstTab = store.getBool(RICH_HISTORY_SETTING_KEYS.starredTabAsFirstTab, false)
    ? Tabs.Starred
    : Tabs.RichHistory;
  const { richHistory } = explore;
  return {
    richHistory,
    firstTab,
    activeDatasourceInstance: datasourceInstance?.name,
  };
}

const mapDispatchToProps = {
  deleteRichHistory,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(RichHistoryContainer));
