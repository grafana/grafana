// Libraries
import React, { PureComponent } from 'react';

// Types
import { Select, SelectOptionItem, DataQuery, PanelData, SeriesData, DataQueryError } from '@grafana/ui';
import { DashboardQuery } from './types';
import config from 'app/core/config';
import { css } from 'emotion';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { PanelModel, DashboardModel } from 'app/features/dashboard/state';
import { SHARED_DASHBODARD_QUERY } from './SharedQueryRunner';

type ResultInfo = {
  img: string; // The Datasource
  refId: string;
  query: string; // As text
  data: SeriesData[];
  error?: DataQueryError;
};

function getQueryDisplayText(query: DataQuery): string {
  return JSON.stringify(query);
}

interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  data: PanelData;

  // Callback after query changes
  onChange: (query: DataQuery) => void;
}

type State = {
  defaultDatasource: string;
  results: ResultInfo[];
};

export class DashboardQueryEditor extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      defaultDatasource: '',
      results: [],
    };
  }

  async componentDidMount() {
    this.componentDidUpdate(null);
  }

  async componentDidUpdate(prevProps: Props) {
    const { data, dashboard } = this.props;
    if (!prevProps || prevProps.data !== data) {
      const defaultDS = await getDatasourceSrv().get(null);
      const panel = dashboard.getPanelById(this.getQuery().panelId);
      if (!panel) {
        this.setState({ defaultDatasource: defaultDS.name });
        return;
      }

      const mainDS = await getDatasourceSrv().get(panel.datasource);
      const info: ResultInfo[] = [];

      for (const query of panel.targets) {
        const ds = query.datasource ? await getDatasourceSrv().get(query.datasource) : mainDS;
        const fmt = ds.getQueryDisplayText ? ds.getQueryDisplayText : getQueryDisplayText;
        info.push({
          refId: query.refId,
          query: fmt(query),
          img: ds.meta.info.logos.small,
          data: data.series.filter(v => v.refId === query.refId),
          error: data.error && data.error.refId === query.refId ? data.error : null,
        });
      }
      this.setState({ defaultDatasource: defaultDS.name, results: info });
    }
  }

  onPanelChanged = (id: number) => {
    const { onChange } = this.props;
    const query = this.getQuery();
    query.panelId = id;
    onChange(query);
  };

  /**
   * Get the current query and make sure dashboard model only has a single query
   */
  getQuery = (): DashboardQuery => {
    const { panel } = this.props;
    if (!panel.targets && !panel.targets.length) {
      const query = { refId: 'A' };
      panel.targets = [query];
      return query;
    }
    if (panel.targets.length > 1) {
      panel.targets = [panel.targets[0]];
    }
    return panel.targets[0];
  };

  renderQueryData(editURL: string) {
    const { results } = this.state;

    return (
      <div>
        {results.map((target, index) => {
          return (
            <div className="query-editor-row__header" key={index}>
              <div className="query-editor-row__ref-id">
                <img src={target.img} width={16} className={css({ marginRight: '8px' })} />
                {target.refId}:
              </div>
              <div className="query-editor-row__collapsed-text">
                <a href={editURL}>
                  {target.query}
                  &nbsp;
                  <i className="fa fa-external-link" />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  getPanelDescription = (panel: PanelModel): string => {
    const { defaultDatasource } = this.state;
    const dsname = panel.datasource ? panel.datasource : defaultDatasource;
    if (panel.targets.length === 1) {
      return '1 query to ' + dsname;
    }
    return panel.targets.length + ' queries to ' + dsname;
  };

  render() {
    const { dashboard } = this.props;
    const query = this.getQuery();

    let selected: SelectOptionItem;
    const panels: SelectOptionItem[] = [];
    for (const panel of dashboard.panels) {
      if (panel.targets && panel.datasource !== SHARED_DASHBODARD_QUERY) {
        const plugin = config.panels[panel.type];
        const item = {
          value: panel.id,
          label: panel.title ? panel.title : 'Panel ' + panel.id,
          description: this.getPanelDescription(panel),
          imgUrl: plugin.info.logos.small,
        };
        panels.push(item);
        if (query.panelId === panel.id) {
          selected = item;
        }
      }
    }

    if (panels.length < 1) {
      return (
        <div className={css({ padding: '10px' })}>
          This dashboard does not have other panels. Add queries to other panels and try again
        </div>
      );
    }

    // Same as current URL, but different panelId
    const editURL = `d/${dashboard.uid}/${dashboard.title}?orgId=1?&fullscreen&edit&panelId=${query.panelId}`;

    return (
      <div>
        <h4>Reuse the results from panel:</h4>
        <div className="gf-form">
          <Select
            placeholder="Choose Panel"
            isSearchable={true}
            options={panels}
            value={selected}
            onChange={item => this.onPanelChanged(item.value)}
          />
        </div>
        <br />
        <br />
        {query.panelId && this.renderQueryData(editURL)}
      </div>
    );
  }
}

export default DashboardQueryEditor;
