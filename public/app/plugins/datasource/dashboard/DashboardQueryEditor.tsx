// Libraries
import React, { PureComponent } from 'react';

// Types
import { LegacyForms, Icon } from '@grafana/ui';
import { DataQuery, DataQueryError, PanelData, DataFrame, SelectableValue } from '@grafana/data';
import { DashboardQuery } from './types';
import config from 'app/core/config';
import { css } from 'emotion';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { PanelModel } from 'app/features/dashboard/state';
import { SHARED_DASHBODARD_QUERY } from './types';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { filterPanelDataToQuery } from 'app/features/dashboard/panel_editor/QueryEditorRow';
const { Select } = LegacyForms;

type ResultInfo = {
  img: string; // The Datasource
  refId: string;
  query: string; // As text
  data: DataFrame[];
  error?: DataQueryError;
};

function getQueryDisplayText(query: DataQuery): string {
  return JSON.stringify(query);
}

interface Props {
  panel: PanelModel;
  panelData: PanelData;
  onChange: (query: DashboardQuery) => void;
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

  getQuery(): DashboardQuery {
    const { panel } = this.props;
    return panel.targets[0] as DashboardQuery;
  }

  async componentDidMount() {
    this.componentDidUpdate(null);
  }

  async componentDidUpdate(prevProps: Props) {
    const { panelData } = this.props;

    if (!prevProps || prevProps.panelData !== panelData) {
      const query = this.props.panel.targets[0] as DashboardQuery;
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

        const qData = filterPanelDataToQuery(panelData, query.refId);
        const queryData = qData ? qData : panelData;

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
    const { onChange } = this.props;
    const query = this.getQuery();
    query.panelId = id;
    onChange(query);

    // Update the
    this.props.panel.refresh();
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
                  <Icon name="external-link-alt" />
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
    const dashboard = getDashboardSrv().getCurrent();
    const query = this.getQuery();

    let selected: SelectableValue<number>;
    const panels: Array<SelectableValue<number>> = [];

    for (const panel of dashboard.panels) {
      const plugin = config.panels[panel.type];
      if (!plugin) {
        continue;
      }

      if (panel.targets && panel.datasource !== SHARED_DASHBODARD_QUERY) {
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
    const editURL = `d/${dashboard.uid}/${dashboard.title}?&editPanel=${query.panelId}`;

    return (
      <div>
        <div className="gf-form">
          <div className="gf-form-label">Use results from panel</div>
          <Select
            placeholder="Choose Panel"
            isSearchable={true}
            options={panels}
            value={selected}
            onChange={item => this.onPanelChanged(item.value)}
          />
        </div>
        <div className={css({ padding: '16px' })}>{query.panelId && this.renderQueryData(editURL)}</div>
      </div>
    );
  }
}
