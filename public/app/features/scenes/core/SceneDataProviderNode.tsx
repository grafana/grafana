import React from 'react';
import { PanelData } from '@grafana/data';
import { Unsubscribable } from 'rxjs/internal/types';
import { DataQueryExtended, SceneQueryRunner } from '../querying/SceneQueryRunner';
import { SceneObjectBase } from './SceneObjectBase';
import { SceneDataState, SceneLayoutState, SceneObject, SceneObjectStatePlain } from './types';

export interface SceneDataProviderNodeState extends SceneObjectStatePlain, SceneLayoutState {
  queries: DataQueryExtended[];
  data?: PanelData;
}

export class SceneDataProviderNode extends SceneObjectBase<SceneDataProviderNodeState> {
  static Component = SceneDataProviderRenderer;
  private runner: SceneQueryRunner;
  private querySub?: Unsubscribable;

  constructor(state: SceneDataProviderNodeState) {
    super(state);
    this.runner = new SceneQueryRunner({ queries: state.queries });
  }

  activate(): void {
    super.activate();

    const timeRange = this.getTimeRange();

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
                this.setState({ data });
              },
            });
          });
        },
      })
    );

    if (!this.state.data) {
      this.runner.runWithTimeRange(timeRange.state.range).then((data) => {
        if (!data) {
          return;
        }

        this.querySub = data.subscribe({
          next: (data) => {
            console.log('set data', data, data.state);
            this.setState({ data });
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

  getData(): SceneObject<SceneDataState> {
    if (!this.isActive) {
      this.activate();
    }

    return this;
  }
}

function SceneDataProviderRenderer() {
  return <h1>SceneDataProviderRenderer</h1>;
}
