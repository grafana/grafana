// Libraries
import React, { useEffect, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { config, reportInteraction } from '@grafana/runtime';
import { useTheme2 } from '@grafana/ui';
// Types
import { ExploreItemState, StoreState } from 'app/types';
import { ExploreId } from 'app/types/explore';

// Components, enums
import { ExploreDrawer } from '../ExploreDrawer';
import {
  deleteRichHistory,
  initRichHistory,
  loadRichHistory,
  loadMoreRichHistory,
  clearRichHistoryResults,
  updateHistorySettings,
  updateHistorySearchFilters,
} from '../state/history';

import { RichHistory, Tabs } from './RichHistory';

//Actions

function mapStateToProps(state: StoreState, { exploreId }: { exploreId: ExploreId }) {
  const explore = state.explore;
  const item: ExploreItemState = explore.panes[exploreId]!;
  const richHistorySearchFilters = item.richHistorySearchFilters;
  const richHistorySettings = explore.richHistorySettings;
  const { datasourceInstance } = item;
  const firstTab = richHistorySettings?.starredTabAsFirstTab ? Tabs.Starred : Tabs.RichHistory;
  const { richHistory, richHistoryTotal } = item;
  return {
    richHistory,
    richHistoryTotal,
    firstTab,
    activeDatasourceInstance: datasourceInstance!.name,
    richHistorySettings,
    richHistorySearchFilters,
  };
}

const mapDispatchToProps = {
  initRichHistory,
  loadRichHistory,
  loadMoreRichHistory,
  clearRichHistoryResults,
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
  const theme = useTheme2();
  const [height, setHeight] = useState(theme.components.horizontalDrawer.defaultHeight);

  const {
    richHistory,
    richHistoryTotal,
    width,
    firstTab,
    activeDatasourceInstance,
    exploreId,
    deleteRichHistory,
    initRichHistory,
    loadRichHistory,
    loadMoreRichHistory,
    clearRichHistoryResults,
    richHistorySettings,
    updateHistorySettings,
    richHistorySearchFilters,
    updateHistorySearchFilters,
    onClose,
  } = props;

  useEffect(() => {
    initRichHistory();
    reportInteraction('grafana_explore_query_history_opened', {
      queryHistoryEnabled: config.queryHistoryEnabled,
    });
  }, [initRichHistory]);

  if (!richHistorySettings) {
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
        richHistoryTotal={richHistoryTotal}
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
        loadRichHistory={loadRichHistory}
        loadMoreRichHistory={loadMoreRichHistory}
        clearRichHistoryResults={clearRichHistoryResults}
      />
    </ExploreDrawer>
  );
}

export default connector(RichHistoryContainer);
