// Libraries
import React, { useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { hot } from 'react-hot-loader';

// Services & Utils
import store from 'app/core/store';
import { RICH_HISTORY_SETTING_KEYS } from 'app/core/utils/richHistory';

// Types
import { ExploreItemState, StoreState } from 'app/types';
import { ExploreId } from 'app/types/explore';

// Components, enums
import { RichHistory, Tabs } from './RichHistory';

//Actions
import { deleteRichHistory } from '../state/history';
import { ExploreDrawer } from '../ExploreDrawer';

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

const connector = connect(mapStateToProps, mapDispatchToProps);

interface OwnProps {
  width: number;
  exploreId: ExploreId;
  onClose: () => void;
}
export type Props = ConnectedProps<typeof connector> & OwnProps;

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

export default hot(module)(connector(RichHistoryContainer));
