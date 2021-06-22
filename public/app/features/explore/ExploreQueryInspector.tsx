import React from 'react';
import { TabbedContainer, TabConfig } from '@grafana/ui';
import { TimeZone } from '@grafana/data';
import { runQueries } from './state/query';
import { StoreState, ExploreItemState, ExploreId } from 'app/types';
import { hot } from 'react-hot-loader';
import { connect, ConnectedProps } from 'react-redux';
import { ExploreDrawer } from 'app/features/explore/ExploreDrawer';
import { InspectJSONTab } from 'app/features/inspector/InspectJSONTab';
import { QueryInspector } from 'app/features/inspector/QueryInspector';
import { InspectStatsTab } from 'app/features/inspector/InspectStatsTab';
import { InspectDataTab } from 'app/features/inspector/InspectDataTab';
import { InspectErrorTab } from 'app/features/inspector/InspectErrorTab';

interface DispatchProps {
  width: number;
  exploreId: ExploreId;
  onClose: () => void;
}

type Props = DispatchProps & ConnectedProps<typeof connector>;

export function ExploreQueryInspector(props: Props) {
  const { loading, width, onClose, queryResponse } = props;
  const dataFrames = queryResponse?.series || [];
  const error = queryResponse?.error;

  const statsTab: TabConfig = {
    label: 'Stats',
    value: 'stats',
    icon: 'chart-line',
    content: <InspectStatsTab data={queryResponse!} timeZone={queryResponse?.request?.timezone as TimeZone} />,
  };

  const jsonTab: TabConfig = {
    label: 'JSON',
    value: 'json',
    icon: 'brackets-curly',
    content: <InspectJSONTab data={queryResponse} onClose={onClose} />,
  };

  const dataTab: TabConfig = {
    label: 'Data',
    value: 'data',
    icon: 'database',
    content: (
      <InspectDataTab
        data={dataFrames}
        isLoading={loading}
        options={{ withTransforms: false, withFieldConfig: false }}
      />
    ),
  };

  const queryTab: TabConfig = {
    label: 'Query',
    value: 'query',
    icon: 'info-circle',
    content: <QueryInspector data={dataFrames} onRefreshQuery={() => props.runQueries(props.exploreId)} />,
  };

  const tabs = [statsTab, queryTab, jsonTab, dataTab];
  if (error) {
    const errorTab: TabConfig = {
      label: 'Error',
      value: 'error',
      icon: 'exclamation-triangle',
      content: <InspectErrorTab error={error} />,
    };
    tabs.push(errorTab);
  }
  return (
    <ExploreDrawer width={width} onResize={() => {}}>
      <TabbedContainer tabs={tabs} onClose={onClose} closeIconTooltip="Close query inspector" />
    </ExploreDrawer>
  );
}

function mapStateToProps(state: StoreState, { exploreId }: { exploreId: ExploreId }) {
  const explore = state.explore;
  const item: ExploreItemState = explore[exploreId]!;
  const { loading, queryResponse } = item;

  return {
    loading,
    queryResponse,
  };
}

const mapDispatchToProps = {
  runQueries,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export default hot(module)(connector(ExploreQueryInspector));
