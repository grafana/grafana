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
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
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

import { DataSourceData, RichHistory, Tabs } from './RichHistory';

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
  const dsSrv = getDatasourceSrv();
  const [datasources, setDatasources] = useState<DataSourceData[]>([]);

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

  useEffect(() => {
    const enhanceDS = async (datasourceInstances: DataSourceRef[]) => {
      const enhancedDatasourceDataProm = await datasourceInstances.map(async (dsI) => {
        const dsData = await dsSrv.get(dsI);
        return {
          ref: dsI,
          name: dsData.name,
        };
      });

      const enhancedDatasourceData = await Promise.all(enhancedDatasourceDataProm);
      setDatasources(enhancedDatasourceData);
    };

    enhanceDS(datasourceInstances);
  }, [datasourceInstances, dsSrv]);

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
      datasourceInstances={datasources}
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
