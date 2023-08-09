import React from 'react';
import { Observable, map } from 'rxjs';

import { DataFrame } from '@grafana/data';
import {
  CustomTransformOperator,
  PanelBuilders,
  SceneDataTransformer,
  SceneFlexItem,
  SceneQueryRunner,
  SceneTimeRange,
} from '@grafana/scenes';
import { DataSourceRef } from '@grafana/schema';
import { Icon, Link } from '@grafana/ui';

import { createUrl } from '../utils/url';

const TOP_5_FIRING_INSTANCES =
  'topk(5, sum by(labels_alertname, ruleUID) (count_over_time({from="state-history"} | json | current = `Alerting` [1w])))';

export function getMostFiredInstancesScene(timeRange: SceneTimeRange, datasource: DataSourceRef, panelTitle: string) {
  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        expr: TOP_5_FIRING_INSTANCES,
        instant: true,
      },
    ],

    $timeRange: timeRange,
  });

  const ruleLinkTransformation: CustomTransformOperator = () => (source: Observable<DataFrame[]>) => {
    return source.pipe(
      map((data: DataFrame[]) => {
        return data.map((frame: DataFrame) => {
          return {
            ...frame,
            fields: frame.fields.map((field) => {
              if (field.name === 'ruleUID') {
                return {
                  ...field,
                  values: field.values.map((v) => (
                    <Link key={v} target="_blank" href={createUrl(`/alerting/grafana/${v}/view`)}>
                      <Icon name="external-link-alt" />
                    </Link>
                  )),
                };
              }
              return field;
            }),
          };
        });
      })
    );
  };

  const transformation = new SceneDataTransformer({
    $data: query,
    transformations: [
      ruleLinkTransformation,
      {
        id: 'sortBy',
        options: {
          fields: {},
          sort: [
            {
              field: 'Value #A',
              desc: true,
            },
          ],
        },
      },
      {
        id: 'organize',
        options: {
          excludeByName: {
            Time: true,
          },
          indexByName: {
            labels_alertname: 0,
            'Value #A': 1,
            ruleUID: 2,
          },
          renameByName: {
            labels_alertname: 'Alert Name',
            'Value #A': 'Fires this week',
            ruleUID: 'Link',
          },
        },
      },
    ],
  });

  return new SceneFlexItem({
    width: '49%',
    height: 300,
    body: PanelBuilders.table().setTitle(panelTitle).setData(transformation).build(),
  });
}
