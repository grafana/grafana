import { DataFrame, TimeRange } from '@grafana/data';
import { usePluginLinks } from '@grafana/runtime';
import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState, SceneQueryRunner } from '@grafana/scenes';
import { DataQuery, DataSourceRef } from '@grafana/schema';
import { IconButton } from '@grafana/ui';

import MimirLogo from '../../../plugins/datasource/prometheus/img/mimir_logo.svg';
import { VAR_DATASOURCE_EXPR } from '../shared';

export interface AddToExplorationButtonState extends SceneObjectState {
  frame?: DataFrame;
  dsUid?: string;
  labelName?: string;
  fieldName?: string;
  context?: ExtensionContext;

  disabledLinks: string[];
  queries: DataQuery[];
}

type ExtensionContext = {
  timeRange: TimeRange;
  queries: DataQuery[];
  datasource: DataSourceRef;
  origin: string;
  url: string;
  type: string;
  title: string;
  id: string;
  logoPath: string;
  note?: string;
  drillDownLabel?: string;
};

export class AddToExplorationButton extends SceneObjectBase<AddToExplorationButtonState> {
  constructor(state: Omit<AddToExplorationButtonState, 'disabledLinks' | 'queries'>) {
    super({ ...state, disabledLinks: [], queries: [] });
    this.addActivationHandler(this.onActivate);
  }

  private onActivate = () => {
    const datasourceUid = sceneGraph.interpolate(this, VAR_DATASOURCE_EXPR);

    this._subs.add(
      this.subscribeToState(() => {
        this.getQueries();
        this.getContext();
      })
    );
    this.setState({ dsUid: datasourceUid });
  };

  private getQueries = () => {
    const data = sceneGraph.getData(this);
    const queryRunner = sceneGraph.findObject(
      data,
      (o) => o instanceof SceneQueryRunner
    ) as unknown as SceneQueryRunner;
    if (queryRunner) {
      const filter = this.state.frame ? getFilter(this.state.frame) : null;
      const queries = queryRunner.state.queries.map((q) => ({
        ...q,
        expr: sceneGraph.interpolate(queryRunner, q.expr),
        legendFormat: filter?.name ? `{{ ${filter.name} }}` : sceneGraph.interpolate(queryRunner, q.legendFormat),
      }));
      if (JSON.stringify(queries) !== JSON.stringify(this.state.queries)) {
        this.setState({ queries });
      }
    }
  };

  private getContext = () => {
    const { queries, dsUid, labelName, fieldName } = this.state;
    const timeRange = sceneGraph.getTimeRange(this);

    if (!timeRange || !queries || !dsUid) {
      return;
    }
    const ctx = {
      origin: 'Explore Metrics',
      type: 'timeseries',
      queries,
      timeRange: { ...timeRange.state.value },
      datasource: { uid: dsUid },
      url: window.location.href,
      id: `${JSON.stringify(queries)}${labelName}${fieldName}`,
      title: `${labelName}${fieldName ? ` > ${fieldName}` : ''}`,
      logoPath: MimirLogo,
      drillDownLabel: fieldName,
    };
    if (JSON.stringify(ctx) !== JSON.stringify(this.state.context)) {
      this.setState({ context: ctx });
    }
  };

  public static Component = ({ model }: SceneComponentProps<AddToExplorationButton>) => {
    const { context, disabledLinks } = model.useState();
    const { links } = usePluginLinks({ extensionPointId: 'grafana-explore-metrics/exploration/v1', context });

    return (
      <>
        {links
          .filter((link) => link.pluginId === 'grafana-explorations-app' && link.onClick)
          .map((link) => (
            <IconButton
              tooltip={link.description}
              disabled={link.category === 'disabled' || disabledLinks.includes(link.id)}
              aria-label="extension-link-to-open-exploration"
              key={link.id}
              name={link.icon ?? 'panel-add'}
              onClick={(e) => {
                if (link.onClick) {
                  link.onClick(e);
                }
                model.setState({ disabledLinks: [...disabledLinks, link.id] });
              }}
            />
          ))}
      </>
    );
  };
}

const getFilter = (frame: DataFrame) => {
  const filterNameAndValueObj = frame.fields[1]?.labels ?? {};
  if (Object.keys(filterNameAndValueObj).length !== 1) {
    return;
  }
  const name = Object.keys(filterNameAndValueObj)[0];
  return { name, value: filterNameAndValueObj[name] };
};
