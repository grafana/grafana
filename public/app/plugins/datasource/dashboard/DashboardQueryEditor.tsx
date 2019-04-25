// Libraries
import React, { PureComponent } from 'react';

// Types
import { Select, SelectOptionItem, DataQuery, SeriesData, DataQueryError, QueryEditorProps } from '@grafana/ui';
import { DashboardQuery } from './types';
import config from 'app/core/config';
import { css } from 'emotion';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { PanelModel } from 'app/features/dashboard/state';
import { SHARED_DASHBODARD_QUERY } from './SharedQueryRunner';
import { DashboardDatasource } from './datasource';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { filterPanelDataToQuery } from 'app/features/dashboard/panel_editor/QueryEditorRow';

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

interface Props extends QueryEditorProps<DashboardDatasource, DashboardQuery> {
  // standard
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
    const { panelData, query } = this.props;
    if (!prevProps || prevProps.panelData !== panelData) {
      const defaultDS = await getDatasourceSrv().get(null);
      const dashboard = getDashboardSrv().getCurrent();
      const panel = dashboard.getPanelById(query.panelId);
      if (!panel) {
        this.setState({ defaultDatasource: defaultDS.name });
        return;
      }

      const mainDS = await getDatasourceSrv().get(panel.datasource);
      const info: ResultInfo[] = [];

      for (const query of panel.targets) {
        const ds = query.datasource ? await getDatasourceSrv().get(query.datasource) : mainDS;
        const fmt = ds.getQueryDisplayText ? ds.getQueryDisplayText : getQueryDisplayText;

        const queryData = filterPanelDataToQuery(panelData, query.refId);
        info.push({
          refId: query.refId,
          query: fmt(query),
          img: ds.meta.info.logos.small,
          data: queryData.series,
          error: queryData.error,
        });
      }
      this.setState({ defaultDatasource: defaultDS.name, results: info });
    }
  }

  onPanelChanged = (id: number) => {
    const { onChange, query } = this.props;
    query.panelId = id;
    onChange(query);
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
    const { query } = this.props;
    const dashboard = getDashboardSrv().getCurrent();

    let selected: SelectOptionItem<number>;
    const panels: Array<SelectOptionItem<number>> = [];
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
      <div className={css({ padding: '16px' })}>
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
        {query.panelId && this.renderQueryData(editURL)}
      </div>
    );
  }
}

export default DashboardQueryEditor;
