// Libraries
import React, { useEffect, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';

// Types
import { ExploreItemState, StoreState } from 'app/types';
import { ExploreId } from 'app/types/explore';

// Components, enums
import { RichHistory, Tabs } from './RichHistory';

//Actions
import {
  deleteRichHistory,
  initRichHistory,
  updateHistorySettings,
  updateHistorySearchFilters,
} from '../state/history';
import { ExploreDrawer } from '../ExploreDrawer';

function mapStateToProps(state: StoreState, { exploreId }: { exploreId: ExploreId }) {
  const explore = state.explore;
  // @ts-ignore
  const item: ExploreItemState = explore[exploreId];
  const richHistorySearchFilters = item.richHistorySearchFilters;
  const richHistorySettings = explore.richHistorySettings;
  const { datasourceInstance } = item;
  const firstTab = richHistorySettings?.starredTabAsFirstTab ? Tabs.Starred : Tabs.RichHistory;
  const { richHistory } = item;
  return {
    richHistory,
    firstTab,
    activeDatasourceInstance: datasourceInstance?.name,
    richHistorySettings,
    richHistorySearchFilters,
  };
}

const mapDispatchToProps = {
  initRichHistory,
  updateHistorySettings,
  updateHistorySearchFilters,
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
    initRichHistory,
    richHistorySettings,
    updateHistorySettings,
    richHistorySearchFilters,
    updateHistorySearchFilters,
    onClose,
  } = props;

  useEffect(() => {
    initRichHistory(exploreId);
  }, [initRichHistory, exploreId]);

  if (!richHistorySettings || !richHistorySearchFilters) {
    return <span>Loading...</span>;
  }

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
        onClose={onClose}
        height={height}
        deleteRichHistory={deleteRichHistory}
        richHistorySettings={richHistorySettings}
        richHistorySearchFilters={richHistorySearchFilters}
        updateHistorySettings={updateHistorySettings}
        updateHistorySearchFilters={updateHistorySearchFilters}
      />
    </ExploreDrawer>
  );
}

export default connector(RichHistoryContainer);
