import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { CoreApp, GrafanaTheme2, LoadingState } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime/src';
import { defaultTimeZone, TimeZone } from '@grafana/schema';
import { TabbedContainer, TabConfig, useStyles2 } from '@grafana/ui';
import { requestIdGenerator } from 'app/core/utils/explore';
import { ExploreDrawer } from 'app/features/explore/ExploreDrawer';
import { InspectDataTab } from 'app/features/inspector/InspectDataTab';
import { InspectErrorTab } from 'app/features/inspector/InspectErrorTab';
import { InspectJSONTab } from 'app/features/inspector/InspectJSONTab';
import { InspectStatsTab } from 'app/features/inspector/InspectStatsTab';
import { QueryInspector } from 'app/features/inspector/QueryInspector';
import { mixedRequestId } from 'app/plugins/datasource/mixed/MixedDataSource';
import { StoreState, ExploreItemState } from 'app/types';

import { GetDataOptions } from '../query/state/PanelQueryRunner';

import { runQueries } from './state/query';

interface DispatchProps {
  exploreId: string;
  timeZone: TimeZone;
  onClose: () => void;
}

type Props = DispatchProps & ConnectedProps<typeof connector>;

export function ExploreQueryInspector(props: Props) {
  const { onClose, queryResponse, timeZone, isMixed, exploreId } = props;
  const [dataOptions, setDataOptions] = useState<GetDataOptions>({
    withTransforms: false,
    withFieldConfig: true,
  });
  const dataFrames = queryResponse?.series || [];
  let errors = queryResponse?.errors;
  if (!errors?.length && queryResponse?.error) {
    errors = [queryResponse.error];
  }
  const styles = useStyles2(getStyles);

  useEffect(() => {
    reportInteraction('grafana_explore_query_inspector_opened');
  }, []);

  const statsTab: TabConfig = {
    label: 'Stats',
    value: 'stats',
    icon: 'chart-line',
    content: <InspectStatsTab data={queryResponse!} timeZone={queryResponse?.request?.timezone ?? defaultTimeZone} />,
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
        dataName={'Explore'}
        isLoading={queryResponse.state === LoadingState.Loading}
        options={dataOptions}
        timeZone={timeZone}
        app={CoreApp.Explore}
        formattedDataDescription="Matches the format in the panel"
        onOptionsChange={setDataOptions}
      />
    ),
  };

  const queryTab: TabConfig = {
    label: 'Query',
    value: 'query',
    icon: 'info-circle',
    content: (
      <div className={styles.queryInspectorWrapper}>
        <QueryInspector
          instanceId={isMixed ? mixedRequestId(0, requestIdGenerator(exploreId)) : requestIdGenerator(exploreId)}
          data={queryResponse}
          onRefreshQuery={() => props.runQueries({ exploreId })}
        />
      </div>
    ),
  };

  const tabs = [statsTab, queryTab, jsonTab, dataTab];
  if (errors?.length) {
    const errorTab: TabConfig = {
      label: 'Error',
      value: 'error',
      icon: 'exclamation-triangle',
      content: <InspectErrorTab errors={errors} />,
    };
    tabs.push(errorTab);
  }
  return (
    <ExploreDrawer>
      <TabbedContainer tabs={tabs} onClose={onClose} closeIconTooltip="Close query inspector" />
    </ExploreDrawer>
  );
}

function mapStateToProps(state: StoreState, { exploreId }: { exploreId: string }) {
  const explore = state.explore;
  const item: ExploreItemState = explore.panes[exploreId]!;
  const { queryResponse } = item;

  return {
    queryResponse,
    isMixed: item.datasourceInstance?.meta.mixed || false,
  };
}

const mapDispatchToProps = {
  runQueries,
};

const getStyles = (theme: GrafanaTheme2) => ({
  queryInspectorWrapper: css({
    paddingBottom: theme.spacing(3),
  }),
});

const connector = connect(mapStateToProps, mapDispatchToProps);

export default connector(ExploreQueryInspector);
