import { cloneDeep } from 'lodash';
import React from 'react';
// import { PanelData } from '@grafana/data';
import { Unsubscribable } from 'rxjs/internal/types';

import { DataQueryExtended, SceneQueryRunner } from '../querying/SceneQueryRunner';

import { SceneDataObject, SceneObjectBase } from './SceneObjectBase';
import { SceneTimeRange } from './SceneTimeRange';
import { SceneDataState, SceneLayoutState, SceneObject, SceneObjectStatePlain } from './types';

type SceneDataProviderInputParams = {
  timeRange: SceneTimeRange;
} & {
  [key: string]: SceneObject;
};

export interface SceneDataProviderNodeState extends SceneObjectStatePlain, SceneLayoutState, SceneDataState {
  queries: DataQueryExtended[];
  inputParams: SceneDataProviderInputParams;
}

export class SceneDataProviderNode extends SceneDataObject<SceneDataProviderNodeState> {
  static Component = SceneDataProviderRenderer;
  private runner: SceneQueryRunner = new SceneQueryRunner({ queries: [] });
  private querySub?: Unsubscribable;
  private staticQueries: DataQueryExtended[] = [];

  private buildStaticQueries() {
    const staticQueries: DataQueryExtended[] = [];

    for (let i = 0; i < this.state.queries.length; i++) {
      const query = this.state.queries[i];
      const staticQuery = cloneDeep(query);

      for (let prop in query) {
        if (Object.prototype.hasOwnProperty.call(query, prop)) {
          console.log(prop, query[prop]);
          if (query[prop] instanceof SceneObjectBase) {
            const node = query[prop];
            console.log('updating', prop, node.state.value);
            staticQuery[prop] = node.state.value;
          }
        }
      }

      staticQueries.push(staticQuery);
    }

    return staticQueries;
  }

  activate(): void {
    super.activate();
    this.staticQueries = this.buildStaticQueries();
    this.runner.updateQueries(this.staticQueries);

    const timeRange = this.state.inputParams.timeRange;

    this.subs.add(
      timeRange.subscribe({
        next: (timeRange) => {
          this.runner.runWithTimeRange(timeRange.range).then((data) => {
            if (!data) {
              return;
            }

            if (this.querySub) {
              this.querySub.unsubscribe();
            }

            this.querySub = data.subscribe({
              next: (data) => {
                console.log('set data', data, data.state);
                this.setState({ $data: data });
              },
            });
          });
        },
      })
    );

    for (const [_, param] of Object.entries(this.state.inputParams)) {
      // skip known params
      if (param === timeRange) {
        continue;
      }

      this.subs.add(
        param.subscribe({
          next: (value) => {
            this.staticQueries = this.buildStaticQueries();
            this.runner.updateQueries(this.staticQueries);
            this.runner.runWithTimeRange(timeRange.state.range).then((data) => {
              if (!data) {
                return;
              }

              if (this.querySub) {
                this.querySub.unsubscribe();
              }

              this.querySub = data.subscribe({
                next: (data) => {
                  console.log('set data', data, data.state);
                  this.setState({ $data: data });
                },
              });
            });
          },
        })
      );
    }

    if (!this.state.$data) {
      this.runner.runWithTimeRange(timeRange.state.range).then((data) => {
        if (!data) {
          return;
        }

        this.querySub = data.subscribe({
          next: (data) => {
            console.log('set data', data, data.state);
            this.setState({ $data: data });
          },
        });
      });
    }
  }

  deactivate(): void {
    super.deactivate();

    if (this.querySub) {
      this.querySub.unsubscribe();
      this.querySub = undefined;
    }
  }

  // getData(): SceneObject<SceneDataState> {
  //   if (!this.isActive) {
  //     this.activate();
  //   }

  //   return this;
  // }

  getTimeRange(): SceneTimeRange {
    return this.state.inputParams.timeRange;
  }
}

function SceneDataProviderRenderer() {
  return <></>;
}
