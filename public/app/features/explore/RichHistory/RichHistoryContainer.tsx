// Libraries
import { flatten, uniqBy } from 'lodash';
import React, { useEffect, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { useAsync } from 'react-use';

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

  // list of unique datasources for streamlined lookup. Add all query datasources
  const queryDatasources = flatten(
    Object.entries(state.explore.panes).map((pane) => pane[1]?.queries.map((q) => q.datasource))
  );
  // then all root datasources - we end up re-looking this up later which is kind of a waste, but this keeps things consistent
  const rootDatasources = flatten(
    Object.entries(state.explore.panes).map((pane) => pane[1]?.datasourceInstance?.getRef())
  );

  const allDs = [...queryDatasources, ...rootDatasources].filter(
    (datasource): datasource is DataSourceRef => !!dataSource
  );

  const uniqueDSInstances = uniqBy(allDs, (ds) => ds.uid);

  // list of exploreID / DS mapping
  const exploreIdDatasources = Object.entries(state.explore.panes)
    .map((pane) => {
      const rootDatasource = [pane[1]?.datasourceInstance?.getRef()];

      const queryDatasources = pane[1]?.queries.map((q) => q.datasource) || [];

      const datasources = [...rootDatasource, ...queryDatasources].filter(
        (datasource): datasource is DataSourceRef => !!dataSource
      );

      if (datasources === undefined || datasources.length === 0) {
        return undefined;
      } else {
        return {
          exploreId: pane[0],
          datasources: uniqBy(datasources, (ds) => ds.uid),
        };
      }
    })
    .filter((pane): pane is { exploreId: string; datasources: DataSourceRef[] } => !!pane);

  const firstTab = richHistorySettings?.starredTabAsFirstTab ? Tabs.Starred : Tabs.RichHistory;
  return {
    richHistory,
    richHistoryTotal,
    firstTab,
    paneDatasources: exploreIdDatasources,
    datasourceInstances: uniqueDSInstances,
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

  useAsync(async () => {
    const enhancedDatasourceDataProm = datasourceInstances.map(async (dsI) => {
      return await dsSrv.get(dsI);
    });
    const enhancedDatasourceData = await Promise.all(enhancedDatasourceDataProm);

    // for each datasource
    const enhancedWithExploreIds = enhancedDatasourceData.map((ds) => {
      const exploreIds: string[] = [];
      // for every pane
      props.paneDatasources.forEach((pane) => {
        // if the pane is using that datasource, add it to a list of relevant ExploreIDs s
        const foundIdx = pane.datasources.findIndex((paneDs) => paneDs.uid === ds.uid);
        if (foundIdx !== -1) {
          exploreIds.push(pane.exploreId);
        }
      });
      return {
        datasource: ds,
        exploreIds: exploreIds,
      };
    });

    setDatasources(enhancedWithExploreIds);
  }, []);

  /* useEffect(() => {
    const enhanceDS = async (datasourceInstances: DataSourceRef[]) => {
      const enhancedDatasourceDataProm = await datasourceInstances.map(async (dsI) => {
        return await dsSrv.get(dsI);
      });

      const enhancedDatasourceData = await Promise.all(enhancedDatasourceDataProm);

      // for each datasource
      const enhancedWithExploreIds = enhancedDatasourceData.map((ds) => {
        const exploreIds: string[] = [];
        // for every pane
        props.paneDatasources.forEach((pane) => {
          // if the pane is using that datasource, add it to a list of relevant ExploreIDs s
          const foundIdx = pane.datasources.findIndex((paneDs) => paneDs.uid === ds.uid);
          if (foundIdx !== -1) {
            exploreIds.push(pane.exploreId);
          }
        });
        return {
          datasource: ds,
          exploreIds: exploreIds,
        };
      });

      setDatasources(enhancedWithExploreIds);
    };

    enhanceDS(datasourceInstances);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); */

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
