import { Observable } from 'rxjs';

import {
  SceneDataProvider,
  SceneDataProviderResult,
  SceneDataState,
  SceneObjectBase,
  SceneObjectRef,
} from '@grafana/scenes';

export interface DataProviderSharerState extends SceneDataState {
  source: SceneObjectRef<SceneDataProvider>;
}

export class DataProviderSharer extends SceneObjectBase<DataProviderSharerState> implements SceneDataProvider {
  public constructor(state: DataProviderSharerState) {
    super({
      source: state.source,
      data: state.source.resolve().state.data,
    });

    this.addActivationHandler(() => {
      this._subs.add(
        this.state.source.resolve().subscribeToState((newState, oldState) => {
          if (newState.data !== oldState.data) {
            this.setState({ data: newState.data });
          }
        })
      );
    });
  }

  public setContainerWidth(width: number) {
    this.state.source.resolve().setContainerWidth?.(width);
  }

  public isDataReadyToDisplay() {
    return this.state.source.resolve().isDataReadyToDisplay?.() ?? true;
  }

  public cancelQuery() {
    this.state.source.resolve().cancelQuery?.();
  }

  public getResultsStream(): Observable<SceneDataProviderResult> {
    return this.state.source.resolve().getResultsStream();
  }
}
