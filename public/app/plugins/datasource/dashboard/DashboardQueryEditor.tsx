// Libraries
import React, { Component } from 'react';

// Types
import { QueryEditorProps, Select, SelectOptionItem, DataQuery } from '@grafana/ui';
import { DashboardDatasource } from './datasource';
import { DashboardQuery } from './types';
import config from 'app/core/config';
import { css } from 'emotion';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';

type Props = QueryEditorProps<DashboardDatasource, DashboardQuery>;

type QueryInfo = {
  refId: string;
  text: string;
  img: string;
};

type State = {
  targets?: QueryInfo[];
  defaultDatasource: string;
};

function getQueryDisplayText(query: DataQuery): string {
  return JSON.stringify(query);
}

// Using PureComponent does not re-render after the dashboard gets set :(
export class DashboardQueryEditor extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      defaultDatasource: '',
    };
  }

  componentDidMount() {
    this.componentDidUpdate(null);
  }

  async componentDidUpdate(prevProps: Props) {
    const { targets } = this.state;
    const { query, datasource } = this.props;
    const { dashboard } = datasource;

    if (!dashboard) {
      return;
    }

    if (targets && prevProps && query.panelId === prevProps.query.panelId) {
      return;
    }

    const defaultDS = await getDatasourceSrv().get(null);
    const ref = dashboard.getPanelById(query.panelId);
    if (ref) {
      console.log('Setting targets', ref.targets);
      getDatasourceSrv()
        .get(ref.datasource)
        .then(ds => {
          const logo = ds.meta.info.logos.small;
          const fmt = ds.getQueryDisplayText ? ds.getQueryDisplayText : getQueryDisplayText;
          this.setState({
            targets: ref.targets.map(query => {
              if (query.datasource) {
                // TODO support mixed!
              }
              return {
                refId: query.refId,
                text: fmt(query),
                img: logo,
              };
            }),
            defaultDatasource: defaultDS.name,
          });
        });
    } else {
      this.setState({ defaultDatasource: defaultDS.name });
    }
  }

  onPanelChanged = (id: number) => {
    const { query, onChange } = this.props;
    onChange({ ...query, panelId: id });
  };

  render() {
    const { query, datasource } = this.props;
    const { dashboard } = datasource;
    const { targets, defaultDatasource } = this.state;

    if (!dashboard) {
      return <div>No Dashboard Registered</div>;
    }

    let selected: SelectOptionItem;
    const panels: SelectOptionItem[] = [];
    for (const panel of dashboard.panels) {
      if (panel.targets && panel.datasource !== '-- Dashboard --') {
        const plugin = config.panels[panel.type];
        const item = {
          value: panel.id,
          label: panel.title + ' (id:' + panel.id + ') ' + (panel.datasource ? panel.datasource : defaultDatasource),
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
    const editURL = `d/${dashboard.uid}/${dashboard.title}?orgId=1?&fullscreen&edit&panelId=`;
    return (
      <div>
        <div className="gf-form">
          <Select
            placeholder="Choose Panel"
            isSearchable={true}
            options={panels}
            value={selected}
            onChange={item => this.onPanelChanged(item.value)}
          />
        </div>
        {targets &&
          targets.map((target, index) => {
            return (
              <div className="query-editor-row__header" key={index}>
                <div className="query-editor-row__ref-id">
                  <img src={target.img} width={16} className={css({ marginRight: '8px' })} />
                  {target.refId}:
                </div>
                <div className="query-editor-row__collapsed-text">
                  <a href={editURL + query.panelId}>
                    {target.text}
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
}

export default DashboardQueryEditor;
