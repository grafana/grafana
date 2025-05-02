import { BehaviorSubject, Observable, pairwise, Subscription } from 'rxjs';

export abstract class ScopesServiceBase<T> {
  private _state: BehaviorSubject<T>;

  protected constructor(initialState: T) {
    this._state = new BehaviorSubject<T>(Object.freeze(initialState));
  }

  public get state(): T {
    return this._state.getValue();
  }

  public get stateObservable(): Observable<T> {
    return this._state.asObservable();
  }

  public subscribeToState = (cb: (newState: T, prevState: T) => void): Subscription => {
    return this._state.pipe(pairwise()).subscribe(([prevState, newState]) => cb(newState, prevState));
  };

  protected updateState = (newState: Partial<T>) => {
    this._state.next(Object.freeze({ ...this.state, ...newState }));
  };
}
