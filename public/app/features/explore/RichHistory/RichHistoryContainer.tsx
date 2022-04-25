import React, { useEffect, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { RICH_HISTORY_SETTING_KEYS } from 'app/core/history/richHistoryLocalStorageUtils';
import store from 'app/core/store';
import { ExploreItemState, StoreState } from 'app/types';
import { ExploreId } from 'app/types/explore';

import { ExploreDrawer } from '../ExploreDrawer';
import { deleteRichHistory, loadRichHistory } from '../state/history';

import { RichHistory, Tabs } from './RichHistory';

function mapStateToProps(state: StoreState, { exploreId }: { exploreId: ExploreId }) {
  const explore = state.explore;
  // @ts-ignore
  const item: ExploreItemState = explore[exploreId];
  const { datasourceInstance } = item;
  const firstTab = store.getBool(RICH_HISTORY_SETTING_KEYS.starredTabAsFirstTab, false)
    ? Tabs.Starred
    : Tabs.RichHistory;
  const { richHistory } = item;
  return {
    richHistory,
    firstTab,
    activeDatasourceInstance: datasourceInstance?.name,
  };
}

const mapDispatchToProps = {
  loadRichHistory,
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

  const {
    richHistory,
    width,
    firstTab,
    activeDatasourceInstance,
    exploreId,
    deleteRichHistory,
    loadRichHistory,
    onClose,
  } = props;

  useEffect(() => {
    loadRichHistory(exploreId);
  }, [loadRichHistory, exploreId]);

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

export default connector(RichHistoryContainer);
