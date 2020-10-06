import React, { useState } from 'react';
import { Button, JSONFormatter, LoadingPlaceholder, TabbedContainer, TabConfig } from '@grafana/ui';
import { AppEvents, PanelData, TimeZone } from '@grafana/data';

import appEvents from 'app/core/app_events';
import { CopyToClipboard } from 'app/core/components/CopyToClipboard/CopyToClipboard';
import { StoreState, ExploreItemState, ExploreId } from 'app/types';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { ExploreDrawer } from 'app/features/explore/ExploreDrawer';
import { useEffectOnce } from 'react-use';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { InspectStatsTab } from '../dashboard/components/Inspector/InspectStatsTab';
import { getPanelInspectorStyles } from '../dashboard/components/Inspector/styles';

function stripPropsFromResponse(response: any) {
  // ignore silent requests
  if (response.config?.hideFromInspector) {
    return {};
  }

  const clonedResponse = { ...response }; // clone - dont modify the response

  if (clonedResponse.headers) {
    delete clonedResponse.headers;
  }

  if (clonedResponse.config) {
    clonedResponse.request = clonedResponse.config;

    delete clonedResponse.config;
    delete clonedResponse.request.transformRequest;
    delete clonedResponse.request.transformResponse;
    delete clonedResponse.request.paramSerializer;
    delete clonedResponse.request.jsonpCallbackParam;
    delete clonedResponse.request.headers;
    delete clonedResponse.request.requestId;
    delete clonedResponse.request.inspect;
    delete clonedResponse.request.retry;
    delete clonedResponse.request.timeout;
  }

  if (clonedResponse.data) {
    clonedResponse.response = clonedResponse.data;

    delete clonedResponse.config;
    delete clonedResponse.data;
    delete clonedResponse.status;
    delete clonedResponse.statusText;
    delete clonedResponse.ok;
    delete clonedResponse.url;
    delete clonedResponse.redirected;
    delete clonedResponse.type;
    delete clonedResponse.$$config;
  }

  return clonedResponse;
}

interface Props {
  loading: boolean;
  width: number;
  exploreId: ExploreId;
  queryResponse?: PanelData;
  onClose: () => void;
}

function ExploreQueryInspector(props: Props) {
  const [formattedJSON, setFormattedJSON] = useState({});

  const getTextForClipboard = () => {
    return JSON.stringify(formattedJSON, null, 2);
  };

  const onClipboardSuccess = () => {
    appEvents.emit(AppEvents.alertSuccess, ['Content copied to clipboard']);
  };

  const [allNodesExpanded, setAllNodesExpanded] = useState(false);
  const getOpenNodeCount = () => {
    if (allNodesExpanded === null) {
      return 3; // 3 is default, ie when state is null
    } else if (allNodesExpanded) {
      return 20;
    }
    return 1;
  };

  const onToggleExpand = () => {
    setAllNodesExpanded(!allNodesExpanded);
  };

  const { loading, width, onClose, queryResponse } = props;

  const [response, setResponse] = useState<PanelData>({} as PanelData);
  useEffectOnce(() => {
    const inspectorStreamSub = getBackendSrv()
      .getInspectorStream()
      .subscribe(resp => {
        const strippedResponse = stripPropsFromResponse(resp);
        setResponse(strippedResponse);
      });

    return () => {
      inspectorStreamSub?.unsubscribe();
    };
  });

  const haveData = response && Object.keys(response).length > 0;
  const styles = getPanelInspectorStyles();

  const statsTab: TabConfig = {
    label: 'Stats',
    value: 'stats',
    icon: 'chart-line',
    content: <InspectStatsTab data={queryResponse!} timeZone={queryResponse?.request?.timezone as TimeZone} />,
  };

  const inspectorTab: TabConfig = {
    label: 'Query Inspector',
    value: 'query_inspector',
    icon: 'info-circle',
    content: (
      <>
        <div className={styles.toolbar}>
          {haveData && (
            <>
              <Button
                icon={allNodesExpanded ? 'minus' : 'plus'}
                variant="secondary"
                className={styles.toolbarItem}
                onClick={onToggleExpand}
              >
                {allNodesExpanded ? 'Collapse' : 'Expand'} all
              </Button>

              <CopyToClipboard
                text={getTextForClipboard}
                onSuccess={onClipboardSuccess}
                elType="div"
                className={styles.toolbarItem}
              >
                <Button icon="copy" variant="secondary">
                  Copy to clipboard
                </Button>
              </CopyToClipboard>
            </>
          )}
          <div className="flex-grow-1" />
        </div>
        <div className={styles.contentQueryInspector}>
          {loading && <LoadingPlaceholder text="Loading query inspector..." />}
          {!loading && haveData && (
            <JSONFormatter json={response!} open={getOpenNodeCount()} onDidRender={setFormattedJSON} />
          )}
          {!loading && !haveData && (
            <p className="muted">No request & response collected yet. Run query to collect request & response.</p>
          )}
        </div>
      </>
    ),
  };

  const tabs = [statsTab, inspectorTab];
  return (
    <ExploreDrawer width={width} onResize={() => {}}>
      <TabbedContainer tabs={tabs} onClose={onClose} closeIconTooltip="Close query inspector" />
    </ExploreDrawer>
  );
}

function mapStateToProps(state: StoreState, { exploreId }: { exploreId: ExploreId }) {
  const explore = state.explore;
  const item: ExploreItemState = explore[exploreId];
  const { loading, queryResponse } = item;

  return {
    loading,
    queryResponse,
  };
}

export default hot(module)(connect(mapStateToProps)(ExploreQueryInspector));
