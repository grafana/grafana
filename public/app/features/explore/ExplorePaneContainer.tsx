import { css } from '@emotion/css';
import memoizeOne from 'memoize-one';
import React from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { EventBusExtended, EventBusSrv, GrafanaTheme2, EventBus } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { reportInteraction } from '@grafana/runtime';
import { Themeable2, withTheme2 } from '@grafana/ui';
import { config } from 'app/core/config';
import store from 'app/core/store';
import {
  DEFAULT_RANGE,
  ensureQueries,
  queryDatasourceDetails,
  getTimeRange,
  getTimeRangeFromUrl,
  lastUsedDatasourceKeyForOrgId,
  parseUrlState,
} from 'app/core/utils/explore';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';
import { StoreState } from 'app/types';
import { ExploreId } from 'app/types/explore';

import { getDatasourceSrv } from '../plugins/datasource_srv';
import { getFiscalYearStartMonth, getTimeZone } from '../profile/state/selectors';

import Explore from './Explore';
import { initializeExplore, refreshExplore } from './state/explorePane';
import { lastSavedUrl, stateSave } from './state/main';
import { importQueries } from './state/query';
import { loadAndInitDatasource } from './state/utils';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    explore: css`
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      overflow: hidden;
      min-width: 600px;
      & + & {
        border-left: 1px dotted ${theme.colors.border.medium};
      }
    `,
  };
};

interface OwnProps extends Themeable2 {
  exploreId: ExploreId;
  urlQuery: string;
  eventBus: EventBus;
}

interface Props extends OwnProps, ConnectedProps<typeof connector> {}

/**
 * This component is responsible for handling initialization of an Explore pane and triggering synchronization
 * of state based on URL changes and preventing any infinite loops.
 */
class ExplorePaneContainerUnconnected extends React.PureComponent<Props> {
  el: HTMLDivElement | null = null;
  exploreEvents: EventBusExtended;

  constructor(props: Props) {
    super(props);
    this.exploreEvents = new EventBusSrv();
    this.state = {
      openDrawer: undefined,
    };
  }

  async componentDidMount() {
    const {
      initialized,
      exploreId,
      initialDatasource,
      initialQueries,
      initialRange,
      panelsState,
      orgId,
      isFromCompactUrl,
    } = this.props;
    const width = this.el?.offsetWidth ?? 0;
    // initialize the whole explore first time we mount and if browser history contains a change in datasource
    if (!initialized) {
      let queriesDatasourceOverride = undefined;
      let rootDatasourceOverride = undefined;
      // if this is starting with no queries and an initial datasource exists (but is not mixed), look up the ref to use it (initial datasource can be a UID or name here)
      if ((!initialQueries || initialQueries.length === 0) && initialDatasource) {
        const isDSMixed =
          initialDatasource === MIXED_DATASOURCE_NAME || initialDatasource.uid === MIXED_DATASOURCE_NAME;
        if (!isDSMixed) {
          const { instance } = await loadAndInitDatasource(orgId, initialDatasource);
          queriesDatasourceOverride = instance.getRef();
        }
      }

      let queries = await ensureQueries(initialQueries, queriesDatasourceOverride); // this will return an empty array if there are no datasources

      const queriesDatasourceDetails = queryDatasourceDetails(queries);
      if (!queriesDatasourceDetails.noneHaveDatasource) {
        if (!queryDatasourceDetails(queries).allDatasourceSame) {
          if (config.featureToggles.exploreMixedDatasource) {
            rootDatasourceOverride = await getDatasourceSrv().get(MIXED_DATASOURCE_NAME);
          } else {
            // if we have mixed queries but the mixed datasource feature is not on, change the datasource to the first query that has one
            const changeDatasourceUid = queries.find((query) => query.datasource?.uid)!.datasource!.uid;
            if (changeDatasourceUid) {
              rootDatasourceOverride = changeDatasourceUid;
              const datasource = await getDatasourceSrv().get(changeDatasourceUid);
              const datasourceInit = await getDatasourceSrv().get(initialDatasource);
              await this.props.importQueries(exploreId, queries, datasourceInit, datasource);
              await this.props.stateSave({ replace: true });
              queries = this.props.initialQueries;
            }
          }
        }
      }

      if (isFromCompactUrl) {
        reportInteraction('grafana_explore_compact_notice');
      }

      this.props.initializeExplore(
        exploreId,
        rootDatasourceOverride || queries[0]?.datasource || initialDatasource,
        queries,
        initialRange,
        width,
        this.exploreEvents,
        panelsState,
        isFromCompactUrl
      );
    }
  }

  componentWillUnmount() {
    this.exploreEvents.removeAllListeners();
  }

  componentDidUpdate(prevProps: Props) {
    this.refreshExplore(prevProps.urlQuery);
  }

  refreshExplore = (prevUrlQuery: string) => {
    const { exploreId, urlQuery } = this.props;

    // Update state from url only if it changed and only if the change wasn't initialised by redux to prevent any loops
    if (urlQuery !== prevUrlQuery && urlQuery !== lastSavedUrl[exploreId]) {
      this.props.refreshExplore(exploreId, urlQuery);
    }
  };

  getRef = (el: HTMLDivElement) => {
    this.el = el;
  };

  render() {
    const { theme, exploreId, initialized, eventBus } = this.props;
    const styles = getStyles(theme);
    return (
      <div className={styles.explore} ref={this.getRef} data-testid={selectors.pages.Explore.General.container}>
        {initialized && <Explore exploreId={exploreId} eventBus={eventBus} />}
      </div>
    );
  }
}

const getTimeRangeFromUrlMemoized = memoizeOne(getTimeRangeFromUrl);

function mapStateToProps(state: StoreState, props: OwnProps) {
  const urlState = parseUrlState(props.urlQuery);
  const timeZone = getTimeZone(state.user);
  const fiscalYearStartMonth = getFiscalYearStartMonth(state.user);

  const { datasource, queries, range: urlRange, panelsState } = urlState || {};
  const initialDatasource = datasource || store.get(lastUsedDatasourceKeyForOrgId(state.user.orgId));
  const initialRange = urlRange
    ? getTimeRangeFromUrlMemoized(urlRange, timeZone, fiscalYearStartMonth)
    : getTimeRange(timeZone, DEFAULT_RANGE, fiscalYearStartMonth);

  return {
    initialized: state.explore.panes[props.exploreId]?.initialized,
    initialDatasource,
    initialQueries: queries,
    initialRange,
    panelsState,
    orgId: state.user.orgId,
    isFromCompactUrl: urlState.isFromCompactUrl || false,
  };
}

const mapDispatchToProps = {
  initializeExplore,
  refreshExplore,
  importQueries,
  stateSave,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export const ExplorePaneContainer = withTheme2(connector(ExplorePaneContainerUnconnected));
