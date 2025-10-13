import { SceneDataProvider, SceneDataState, SceneObjectBase } from '@grafana/scenes';

export class ShareDataProvider extends SceneObjectBase<SceneDataState> implements SceneDataProvider {
  public constructor(private _source: SceneDataProvider) {
    super(_source.state);
    this.addActivationHandler(() => this.activationHandler());
  }

  private activationHandler() {
    this._subs.add(this._source.subscribeToState((state) => this.setState({ data: state.data })));
    this.setState(this._source.state);
  }

  public setContainerWidth(width: number) {
    if (this.state.$data && this.state.$data.setContainerWidth) {
      this.state.$data.setContainerWidth(width);
    }
  }

  public isDataReadyToDisplay() {
    if (!this._source.isDataReadyToDisplay) {
      return true;
    }

    return this._source.isDataReadyToDisplay?.();
  }

  public cancelQuery() {
    this._source.cancelQuery?.();
  }

  public getResultsStream() {
    return this._source.getResultsStream!();
  }
}
