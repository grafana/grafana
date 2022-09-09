import { cloneDeep } from 'lodash';
import { Unsubscribable } from 'rxjs/internal/types';

import { DataQueryExtended, SceneQueryRunner } from '../querying/SceneQueryRunner';

import { SceneDataObject, SceneObjectBase } from './SceneObjectBase';
import { SceneDataState, SceneObject, SceneParametrizedState, SceneTimeRangeState } from './types';

type SceneDataProviderInputParams = {
  timeRange: SceneObject<SceneTimeRangeState>;
} & {
  [key: string]: SceneObject;
};

export interface SceneDataProviderNodeState
  extends SceneDataState,
    SceneParametrizedState<SceneDataProviderInputParams> {
  queries: DataQueryExtended[];
}

export class SceneDataProviderNode extends SceneDataObject<SceneDataProviderNodeState> {
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
    // console.log(timeRange);
    // debugger;
    this.subs.add(
      this.state.inputParams.timeRange.subscribe({
        next: (timeRange) => {
          this.runner.runWithTimeRange(timeRange.range!).then((data) => {
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
            this.runner.runWithTimeRange(timeRange.state.range!).then((data) => {
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
      this.runner.runWithTimeRange(timeRange.state.range!).then((data) => {
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

  toJSON() {
    return {
      queries: [...this.state.queries],
    };
  }
}
