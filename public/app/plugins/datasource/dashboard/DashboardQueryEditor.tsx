import React, { PureComponent } from 'react';
import { LegacyForms, VerticalGroup } from '@grafana/ui';
import { DataQuery, PanelData, SelectableValue } from '@grafana/data';
import { css } from '@emotion/css';

import { DashboardQuery, ResultInfo, SHARED_DASHBODARD_QUERY } from './types';
import config from 'app/core/config';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { PanelModel } from 'app/features/dashboard/state';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { filterPanelDataToQuery } from 'app/features/query/components/QueryEditorRow';
import { DashboardQueryRow } from './DashboardQueryRow';

const { Select } = LegacyForms;

function getQueryDisplayText(query: DataQuery): string {
  return JSON.stringify(query);
}

interface Props {
  queries: DataQuery[];
  panelData: PanelData;
  onChange: (queries: DataQuery[]) => void;
  onRunQueries: () => void;
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
    return this.props.queries[0] as DashboardQuery;
  }

  async componentDidMount() {
    await this.updateState();
  }

  async componentDidUpdate(prevProps: Props) {
    const { panelData, queries } = this.props;

    if (prevProps.panelData !== panelData || prevProps.queries !== queries) {
      await this.updateState();
    }
  }

  async updateState() {
    const { panelData, queries } = this.props;

    const query = queries[0] as DashboardQuery;
    const defaultDS = await getDatasourceSrv().get();
    const dashboard = getDashboardSrv().getCurrent();
    const panel = dashboard?.getPanelById(query.panelId ?? -124134);

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

  onPanelChanged = (id: number) => {
    const query = this.getQuery();

    this.props.onChange([
      {
        ...query,
        panelId: id,
      } as DashboardQuery,
    ]);
    this.props.onRunQueries();
  };

  renderQueryData(editURL: string) {
    const { results } = this.state;

    return (
      <VerticalGroup spacing="sm">
        {results.map((target, index) => {
          return <DashboardQueryRow editURL={editURL} target={target} key={`DashboardQueryRow-${index}`} />;
        })}
      </VerticalGroup>
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
    if (!dashboard) {
      return null;
    }

    const query = this.getQuery();

    let selected: SelectableValue<number> | undefined;
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
            menuShouldPortal
            placeholder="Choose Panel"
            isSearchable={true}
            options={panels}
            value={selected}
            onChange={(item) => this.onPanelChanged(item.value!)}
          />
        </div>
        <div className={css({ padding: '16px' })}>{query.panelId && this.renderQueryData(editURL)}</div>
      </div>
    );
  }
}
