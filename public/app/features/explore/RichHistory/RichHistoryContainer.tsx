// Libraries
import { flatten } from 'lodash';
import React, { useEffect, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { config, reportInteraction } from '@grafana/runtime';
import { DataSourceRef } from '@grafana/schema';
import { useTheme2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
// Types
import { dataSource } from 'app/features/expressions/ExpressionDatasource';
import { StoreState } from 'app/types';

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

function mapStateToProps(state: StoreState) {
  const explore = state.explore;
  const richHistorySearchFilters = explore.richHistorySearchFilters;
  const { richHistorySettings, richHistory, richHistoryTotal } = explore;
  const datasourceInstances = flatten(
    Object.entries(state.explore.panes).map((pane) => pane[1]?.queries.map((q) => q.datasource))
  ).filter((datasource): datasource is DataSourceRef => !!dataSource);
  const firstTab = richHistorySettings?.starredTabAsFirstTab ? Tabs.Starred : Tabs.RichHistory;
  return {
    richHistory,
    richHistoryTotal,
    firstTab,
    datasourceInstances,
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
  const [height, setHeight] = useState(theme.components.horizontalDrawer.defaultHeight);

  const {
    richHistory,
    richHistoryTotal,
    firstTab,
    datasourceInstances,
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
    <ExploreDrawer
      onResize={(_e, _dir, ref) => {
        setHeight(Number(ref.style.height.slice(0, -2)));
      }}
    >
      <RichHistory
        richHistory={richHistory}
        richHistoryTotal={richHistoryTotal}
        firstTab={firstTab}
        datasourceInstances={datasourceInstances}
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
