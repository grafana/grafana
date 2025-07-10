// Libraries
import { useEffect, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { Trans } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { useTheme2 } from '@grafana/ui';
// Types
import { StoreState } from 'app/types/store';

// Components, enums
import { useQueriesDrawerContext } from '../QueriesDrawer/QueriesDrawerContext';
import {
  deleteRichHistory,
  initRichHistory,
  loadRichHistory,
  loadMoreRichHistory,
  clearRichHistoryResults,
  updateHistorySettings,
  updateHistorySearchFilters,
} from '../state/history';

import { RichHistory } from './RichHistory';

//Actions

function mapStateToProps(state: StoreState) {
  const explore = state.explore;
  const richHistorySearchFilters = explore.richHistorySearchFilters;
  const { richHistorySettings, richHistory, richHistoryTotal } = explore;

  return {
    richHistory,
    richHistoryTotal,
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
  onClose: () => void;
}
export type Props = ConnectedProps<typeof connector> & OwnProps;

export function RichHistoryContainer(props: Props) {
  const theme = useTheme2();

  const {
    richHistory,
    richHistoryTotal,
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
  }, [initRichHistory]);

  const { selectedTab } = useQueriesDrawerContext();
  const [tracked, setTracked] = useState(false);

  useEffect(() => {
    if (!tracked) {
      setTracked(true);
      reportInteraction('grafana_explore_query_history_opened', {
        queryHistoryEnabled: config.queryHistoryEnabled,
        selectedTab,
      });
    }
  }, [tracked, selectedTab]);

  if (!richHistorySettings) {
    return (
      <span>
        <Trans i18nKey="explore.rich-history-container.loading">Loading...</Trans>
      </span>
    );
  }

  return (
    <RichHistory
      richHistory={richHistory}
      richHistoryTotal={richHistoryTotal}
      firstTab={selectedTab}
      onClose={onClose}
      height={theme.components.horizontalDrawer.defaultHeight}
      deleteRichHistory={deleteRichHistory}
      richHistorySettings={richHistorySettings}
      richHistorySearchFilters={richHistorySearchFilters}
      updateHistorySettings={updateHistorySettings}
      updateHistorySearchFilters={updateHistorySearchFilters}
      loadRichHistory={loadRichHistory}
      loadMoreRichHistory={loadMoreRichHistory}
      clearRichHistoryResults={clearRichHistoryResults}
    />
  );
}

export default connector(RichHistoryContainer);
