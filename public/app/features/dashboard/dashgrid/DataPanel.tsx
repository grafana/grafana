// Library
import React, { PureComponent } from 'react';

// Services
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';

// Types
import { TimeRange, LoadingState } from 'app/types';

interface RenderProps {
  loading: LoadingState;
  data: any;
}

export interface Props {
  datasource: string | null;
  queries: any[];
  panelId?: number;
  dashboardId?: number;
  isVisible?: boolean;
  timeRange?: TimeRange;
  refreshCounter: number;
  children: (r: RenderProps) => JSX.Element;
}

export interface State {
  isFirstLoad: boolean;
  loading: LoadingState;
  data: any;
}

export class DataPanel extends PureComponent<Props, State> {
  static defaultProps = {
    isVisible: true,
    panelId: 1,
    dashboardId: 1,
  };

  constructor(props: Props) {
    super(props);

    this.state = {
      loading: LoadingState.NotStarted,
      data: [],
      isFirstLoad: true,
    };
  }

  componentDidMount() {
    console.log('DataPanel mount');
    this.issueQueries();
  }

  issueQueries = async () => {
    const { isVisible, queries, datasource, panelId, dashboardId, timeRange } = this.props;

    if (!isVisible) {
      return;
    }

    if (!queries.length) {
      this.setState({ data: [], loading: LoadingState.Done });
      return;
    }

    this.setState({ loading: LoadingState.Loading });

    try {
      const dataSourceSrv = getDatasourceSrv();
      const ds = await dataSourceSrv.get(datasource);

      const queryOptions = {
        timezone: 'browser',
        panelId: panelId,
        dashboardId: dashboardId,
        range: timeRange,
        rangeRaw: timeRange.raw,
        interval: '1s',
        intervalMs: 1000,
        targets: queries,
        maxDataPoints: 500,
        scopedVars: {},
        cacheTimeout: null,
      };

      const resp = await ds.query(queryOptions);
      console.log(resp);
    } catch (err) {
      console.log('Loading error', err);
      this.setState({ loading: LoadingState.Error });
    }
  };

  render() {
    const { data, loading, isFirstLoad } = this.state;
    console.log('data panel render');

    if (isFirstLoad && (loading === LoadingState.Loading || loading === LoadingState.NotStarted)) {
      return (
        <div className="loading">
          <p>Loading</p>
        </div>
      );
    }

    return (
      <>
        {this.loadingSpinner}
        {this.props.children({
          data,
          loading,
        })}
      </>
    );
  }

  private get loadingSpinner(): JSX.Element {
    const { loading } = this.state;

    if (loading === LoadingState.Loading) {
      return (
        <div className="panel__loading">
          <i className="fa fa-spinner fa-spin" />
        </div>
      );
    }

    return null;
  }
}
