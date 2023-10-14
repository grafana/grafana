import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, PageLayoutType } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import {
  AdHocFilterSet,
  AdHocFiltersVariable,
  EmbeddedScene,
  EmbeddedSceneState,
  getUrlSyncManager,
  MultiValueVariable,
  PanelBuilders,
  QueryVariable,
  SceneApp,
  SceneAppPage,
  SceneAppPageLike,
  SceneComponentProps,
  SceneControlsSpacer,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneQueryRunner,
  SceneRefreshPicker,
  SceneRouteMatch,
  SceneTimePicker,
  SceneTimeRange,
  sceneUtils,
  SceneVariableSet,
  VariableDependencyConfig,
  VariableValueOption,
  VariableValueSelectors,
} from '@grafana/scenes';
import { VariableHide } from '@grafana/schema';
import { Card, Input, useStyles2 } from '@grafana/ui';
import { Flex } from '@grafana/ui/src/unstable';
import { Page } from 'app/core/components/Page/Page';

export interface DataTrailState extends SceneObjectState {
  scene: EmbeddedScene;
  metric?: string;
}

export class DataTrail extends SceneObjectBase<DataTrailState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['metric'] });

  public constructor(state: DataTrailState) {
    super(state);

    this.addActivationHandler(this._onActivate.bind(this));
  }

  getUrlState() {
    return { metric: this.state.metric };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    console.log('updateFromUrl', values);

    if (typeof values.metric === 'string') {
      if (this.state.metric !== values.metric) {
        this.setState({
          metric: values.metric,
          scene: buildInitialMetricScene(values.metric),
        });
      }
    } else if (this.state.metric) {
      this.setState({
        metric: undefined,
        scene: buildSelectMetricScene(),
      });
    }
  }

  public _onActivate() {
    if (!this.state.metric) {
      this.setState({ scene: buildSelectMetricScene() });
    }
  }

  static Component = ({ model }: SceneComponentProps<DataTrail>) => {
    const { scene } = model.useState();

    return <scene.Component model={scene} />;
  };
}

export interface TrailPhaseSelectMetricState extends SceneObjectState {}

export class TrailPhaseSelectMetric extends SceneObjectBase<TrailPhaseSelectMetricState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: ['metricName'],
  });

  public getMetricNames(): VariableValueOption[] {
    const variable = sceneGraph.lookupVariable('metricName', this);
    if (variable instanceof MultiValueVariable) {
      return variable.state.options;
    }

    return [];
  }

  static Component = ({ model }: SceneComponentProps<TrailPhaseSelectMetric>) => {
    model.useState();
    const options = model.getMetricNames();

    return (
      <Flex direction="column" gap={0}>
        <Flex direction="column" gap={2}>
          <Input placeholder="Search metrics" />
          <div></div>
        </Flex>
        {options.map((option, index) => (
          <Card
            key={index}
            href={sceneGraph.interpolate(
              model,
              `\${__url.path}/new-step2\${__url.params:exclude:var-metricName}&metric=${option.value}`
            )}
          >
            <Card.Heading>{String(option.value)}</Card.Heading>
          </Card>
        ))}
      </Flex>
    );
  };
}

export interface DataTrailsAppState extends SceneObjectState {
  trail?: DataTrail;
}

export class DataTrailsApp extends SceneObjectBase<DataTrailsAppState> {
  public constructor(state: Partial<DataTrailsAppState>) {
    super(state);

    this.addActivationHandler(() => {
      const trail = new DataTrail({
        scene: buildSelectMetricScene(),
      });

      getUrlSyncManager().initSync(trail);
      this.setState({ trail });
    });
  }

  static Component = ({ model }: SceneComponentProps<DataTrailsApp>) => {
    const { trail } = model.useState();

    if (!trail) {
      return null;
    }

    return (
      <Page navId="explore" pageNav={{ text: 'Data trails' }}>
        {trail && <trail.Component model={trail} />}
      </Page>
    );
  };
}

export const trailsDS = { uid: 'gdev-prometheus', type: 'prometheus' };

export const dataTrailsApp = new SceneApp({
  pages: [
    new SceneAppPage({
      title: 'Data trails',
      url: '/data-trails',
      preserveUrlKeys: ['from', 'to', 'var-filters'],
      getScene: buildSelectMetricScene,
      drilldowns: [
        {
          routePath: '/data-trails/new-step2',
          getPage: buildInitialMetricScene,
        },
      ],
    }),
  ],
});

function getSceneDefaults(): Partial<EmbeddedSceneState> {
  return {
    controls: [
      new VariableValueSelectors({}),
      new SceneControlsSpacer(),
      new SceneTimePicker({}),
      new SceneRefreshPicker({}),
    ],
    $timeRange: new SceneTimeRange({}),
  };
}

function buildSelectMetricScene() {
  return new EmbeddedScene({
    ...getSceneDefaults(),
    $variables: new SceneVariableSet({
      variables: [
        AdHocFiltersVariable.create({
          name: 'filters',
          datasource: trailsDS,
          filters: [],
        }),
        new QueryVariable({
          name: 'metricName',
          datasource: trailsDS,
          hide: VariableHide.hideVariable,
          includeAll: true,
          defaultToAll: true,
          query: { query: 'label_values({$filters},__name__)', refId: 'A' },
        }),
      ],
    }),
    body: new TrailPhaseSelectMetric({}),
  });
}

function buildInitialMetricScene(match: SceneRouteMatch<{ metric?: string }>, parent: SceneAppPageLike) {
  const metric = decodeURIComponent(match.params.metric!);
  const baseUrl = `/data-trails/${encodeURIComponent(metric)}`;

  return new SceneAppPage({
    title: 'Data trails',
    url: `/data-trails/new-step2`,
    getParentPage: () => parent,
    preserveUrlKeys: ['from', 'to', 'var-filters'],
    getScene: () => {
      return new EmbeddedScene({
        ...getSceneDefaults(),
        $variables: new SceneVariableSet({
          variables: [
            AdHocFiltersVariable.create({
              name: 'labelFilters',
              datasource: trailsDS,
              filters: [],
            }),
          ],
        }),
        body: new SceneFlexLayout({
          children: [
            new SceneFlexItem({
              body: PanelBuilders.timeseries()
                .setTitle(metric)
                .setData(
                  new SceneQueryRunner({
                    datasource: trailsDS,
                    queries: [
                      {
                        refId: 'A',
                        expr: `sum(rate(${metric}{\${filters}}[$__rate_interval]))`,
                      },
                    ],
                  })
                )
                .build(),
            }),
          ],
        }),
      });
    },
  });
}

function getSceneStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      flexGrow: 1,
      display: 'flex',
      gap: theme.spacing(2),
      minHeight: '100%',
      flexDirection: 'column',
    }),
    body: css({
      flexGrow: 1,
      display: 'flex',
      gap: '8px',
    }),
    controls: css({
      display: 'flex',
      gap: theme.spacing(1),
      alignItems: 'center',
      flexWrap: 'wrap',
    }),
  };
}
