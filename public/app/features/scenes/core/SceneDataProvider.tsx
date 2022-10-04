import { Unsubscribable } from 'rxjs/internal/types';

import { TimeRange } from '@grafana/data';

import { DataQueryExtended, SceneQueryRunner } from '../querying/SceneQueryRunner';

import { SceneDataObject } from './SceneObjectBase';
import { SceneDataState } from './types';

export interface SceneDataProviderState extends SceneDataState {
  queries: DataQueryExtended[];
}

export class SceneDataProvider extends SceneDataObject<SceneDataProviderState> {
  private runner: SceneQueryRunner = new SceneQueryRunner({ queries: [] });
  private querySub?: Unsubscribable;

  constructor(state: SceneDataProviderState) {
    super(state);
    this.runner.queries = state.queries;
  }

  activate(): void {
    super.activate();
    const timeRange = this.getTimeRange();

    this.subs.add(
      timeRange.subscribe({
        next: (range) => {
          this.performQueries(range.range);
        },
      })
    );

    if (!this.state.$data) {
      this.performQueries();
    }
  }

  deactivate(): void {
    super.deactivate();

    if (this.querySub) {
      this.querySub.unsubscribe();
      this.querySub = undefined;
    }
  }

  performQueries(range?: TimeRange) {
    let timeRange = range ?? this.getTimeRange().state.range;

    this.runner.runWithTimeRange(timeRange).then((data) => {
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
  }

  setState(update: Partial<SceneDataProviderState>): void {
    super.setState(update);

    if (update.queries) {
      this.runner.queries = update.queries;
      this.performQueries();
    }
  }
}
