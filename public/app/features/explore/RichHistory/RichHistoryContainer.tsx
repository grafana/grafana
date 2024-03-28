// Libraries
import React, { useEffect } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { config, reportInteraction } from '@grafana/runtime';
import { useTheme2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
// Types
import { StoreState } from 'app/types';

// Components, enums
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

function mapStateToProps(state: StoreState) {
  const explore = state.explore;
  const richHistorySearchFilters = explore.richHistorySearchFilters;
  const { richHistorySettings, richHistory, richHistoryTotal } = explore;

  const firstTab = richHistorySettings?.starredTabAsFirstTab ? Tabs.Starred : Tabs.RichHistory;
  return {
    richHistory,
    richHistoryTotal,
    firstTab,
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
    firstTab,
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
      firstTab={firstTab}
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
