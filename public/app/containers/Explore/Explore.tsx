import React from 'react';
import { hot } from 'react-hot-loader';
import colors from 'app/core/utils/colors';
import TimeSeries from 'app/core/time_series2';

import ElapsedTime from './ElapsedTime';
import Legend from './Legend';
import QueryRows from './QueryRows';
import Graph from './Graph';
import Table from './Table';
import { DatasourceSrv } from 'app/features/plugins/datasource_srv';
import { buildQueryOptions, ensureQueries, generateQueryKey, hasQuery } from './utils/query';

function makeTimeSeriesList(dataList, options) {
  return dataList.map((seriesData, index) => {
    const datapoints = seriesData.datapoints || [];
    const alias = seriesData.target;

    const colorIndex = index % colors.length;
    const color = colors[colorIndex];

    const series = new TimeSeries({
      datapoints: datapoints,
      alias: alias,
      color: color,
      unit: seriesData.unit,
    });

    if (datapoints && datapoints.length > 0) {
      const last = datapoints[datapoints.length - 1][1];
      const from = options.range.from;
      if (last - from < -10000) {
        series.isOutsideRange = true;
      }
    }

    return series;
  });
}

interface IExploreState {
  datasource: any;
  datasourceError: any;
  datasourceLoading: any;
  graphResult: any;
  latency: number;
  loading: any;
  queries: any;
  requestOptions: any;
  showingGraph: boolean;
  showingTable: boolean;
  tableResult: any;
}

// @observer
export class Explore extends React.Component<any, IExploreState> {
  datasourceSrv: DatasourceSrv;

  constructor(props) {
    super(props);
    this.state = {
      datasource: null,
      datasourceError: null,
      datasourceLoading: true,
      graphResult: null,
      latency: 0,
      loading: false,
      queries: ensureQueries(),
      requestOptions: null,
      showingGraph: true,
      showingTable: true,
      tableResult: null,
    };
  }

  async componentDidMount() {
    const datasource = await this.props.datasourceSrv.get();
    const testResult = await datasource.testDatasource();
    if (testResult.status === 'success') {
      this.setState({ datasource, datasourceError: null, datasourceLoading: false });
    } else {
      this.setState({ datasource: null, datasourceError: testResult.message, datasourceLoading: false });
    }
  }

  handleAddQueryRow = index => {
    const { queries } = this.state;
    const nextQueries = [
      ...queries.slice(0, index + 1),
      { query: '', key: generateQueryKey() },
      ...queries.slice(index + 1),
    ];
    this.setState({ queries: nextQueries });
  };

  handleChangeQuery = (query, index) => {
    const { queries } = this.state;
    const nextQuery = {
      ...queries[index],
      query,
    };
    const nextQueries = [...queries];
    nextQueries[index] = nextQuery;
    this.setState({ queries: nextQueries });
  };

  handleClickGraphButton = () => {
    this.setState(state => ({ showingGraph: !state.showingGraph }));
  };

  handleClickTableButton = () => {
    this.setState(state => ({ showingTable: !state.showingTable }));
  };

  handleRemoveQueryRow = index => {
    const { queries } = this.state;
    if (queries.length <= 1) {
      return;
    }
    const nextQueries = [...queries.slice(0, index), ...queries.slice(index + 1)];
    this.setState({ queries: nextQueries }, () => this.handleSubmit());
  };

  handleSubmit = () => {
    const { showingGraph, showingTable } = this.state;
    if (showingTable) {
      this.runTableQuery();
    }
    if (showingGraph) {
      this.runGraphQuery();
    }
  };

  async runGraphQuery() {
    const { datasource, queries } = this.state;
    if (!hasQuery(queries)) {
      return;
    }
    this.setState({ latency: 0, loading: true, graphResult: null });
    const now = Date.now();
    const options = buildQueryOptions({
      format: 'time_series',
      interval: datasource.interval,
      instant: false,
      now,
      queries: queries.map(q => q.query),
    });
    try {
      const res = await datasource.query(options);
      const result = makeTimeSeriesList(res.data, options);
      const latency = Date.now() - now;
      this.setState({ latency, loading: false, graphResult: result, requestOptions: options });
    } catch (error) {
      console.error(error);
      this.setState({ loading: false, graphResult: error });
    }
  }

  async runTableQuery() {
    const { datasource, queries } = this.state;
    if (!hasQuery(queries)) {
      return;
    }
    this.setState({ latency: 0, loading: true, tableResult: null });
    const now = Date.now();
    const options = buildQueryOptions({
      format: 'table',
      interval: datasource.interval,
      instant: true,
      now,
      queries: queries.map(q => q.query),
    });
    try {
      const res = await datasource.query(options);
      const tableModel = res.data[0];
      const latency = Date.now() - now;
      this.setState({ latency, loading: false, tableResult: tableModel, requestOptions: options });
    } catch (error) {
      console.error(error);
      this.setState({ loading: false, tableResult: null });
    }
  }

  request = url => {
    const { datasource } = this.state;
    return datasource.metadataRequest(url);
  };

  render() {
    const {
      datasource,
      datasourceError,
      datasourceLoading,
      graphResult,
      latency,
      loading,
      queries,
      requestOptions,
      showingGraph,
      showingTable,
      tableResult,
    } = this.state;
    const showingBoth = showingGraph && showingTable;
    const graphHeight = showingBoth ? '200px' : null;
    const graphButtonClassName = showingBoth || showingGraph ? 'btn m-r-1' : 'btn btn-inverse m-r-1';
    const tableButtonClassName = showingBoth || showingTable ? 'btn m-r-1' : 'btn btn-inverse m-r-1';
    return (
      <div className="explore">
        <div className="page-body page-full">
          <h2 className="page-sub-heading">Explore</h2>
          {datasourceLoading ? <div>Loading datasource...</div> : null}

          {datasourceError ? <div title={datasourceError}>Error connecting to datasource.</div> : null}

          {datasource ? (
            <div className="m-r-3">
              <div className="nav m-b-1">
                <div className="pull-right">
                  {loading || latency ? <ElapsedTime time={latency} className="" /> : null}
                  <button type="submit" className="m-l-1 btn btn-primary" onClick={this.handleSubmit}>
                    <i className="fa fa-return" /> Run Query
                  </button>
                </div>
                <div>
                  <button className={graphButtonClassName} onClick={this.handleClickGraphButton}>
                    Graph
                  </button>
                  <button className={tableButtonClassName} onClick={this.handleClickTableButton}>
                    Table
                  </button>
                </div>
              </div>
              <QueryRows
                queries={queries}
                request={this.request}
                onAddQueryRow={this.handleAddQueryRow}
                onChangeQuery={this.handleChangeQuery}
                onExecuteQuery={this.handleSubmit}
                onRemoveQueryRow={this.handleRemoveQueryRow}
              />
              <main className="m-t-2">
                {showingGraph ? (
                  <Graph data={graphResult} id="explore-1" options={requestOptions} height={graphHeight} />
                ) : null}
                {showingGraph ? <Legend data={graphResult} /> : null}
                {showingTable ? <Table data={tableResult} className="m-t-3" /> : null}
              </main>
            </div>
          ) : null}
        </div>
      </div>
    );
  }
}

export default hot(module)(Explore);
