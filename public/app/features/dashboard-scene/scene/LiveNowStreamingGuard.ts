import { type Unsubscribable } from 'rxjs';

import {
  SceneObjectBase,
  type SceneObjectState,
  SceneObjectStateChangedEvent,
  behaviors,
  sceneGraph,
} from '@grafana/scenes';

import { hasStreamingDataSource } from '../utils/hasStreamingDataSource';

const SYNC_DEBOUNCE_MS = 100;

interface LiveNowStreamingGuardState extends SceneObjectState {
  userEnabled: boolean;
}

/**
 * Manages a sibling `behaviors.LiveNowTimer` so the timer only runs when the
 * dashboard actually has a streaming-capable datasource. The saved user intent
 * lives on this guard (not on the timer) so that toggling streaming presence
 * never mutates what we serialize back out.
 */
export class LiveNowStreamingGuard extends SceneObjectBase<LiveNowStreamingGuardState> {
  private _eventSub: Unsubscribable | undefined;
  private _syncTimeoutId: number | undefined;

  public constructor({ userEnabled = false }: { userEnabled?: boolean } = {}) {
    super({ userEnabled });
    this.addActivationHandler(this._activationHandler);
  }

  public setUserEnabled(userEnabled: boolean) {
    this.setState({ userEnabled });
    this._sync();
  }

  public get isEnabled() {
    return this.state.userEnabled;
  }

  private _activationHandler = () => {
    this._sync();

    this._eventSub = this.getRoot().subscribeToEvent(SceneObjectStateChangedEvent, () => {
      this._scheduleSync();
    });

    return () => {
      this._eventSub?.unsubscribe();
      this._eventSub = undefined;
      if (this._syncTimeoutId !== undefined) {
        window.clearTimeout(this._syncTimeoutId);
        this._syncTimeoutId = undefined;
      }
    };
  };

  private _scheduleSync() {
    if (this._syncTimeoutId !== undefined) {
      return;
    }
    this._syncTimeoutId = window.setTimeout(() => {
      this._syncTimeoutId = undefined;
      this._sync();
    }, SYNC_DEBOUNCE_MS);
  }

  private _sync() {
    const timer = this._findTimer();
    if (!timer) {
      return;
    }

    const shouldRun = this.state.userEnabled && hasStreamingDataSource(this.getRoot());

    if (shouldRun && !timer.state.enabled) {
      timer.enable();
    } else if (!shouldRun && timer.state.enabled) {
      timer.disable();
    }
  }

  private _findTimer(): behaviors.LiveNowTimer | undefined {
    const found = sceneGraph.findObject(this.getRoot(), (obj) => obj instanceof behaviors.LiveNowTimer);
    return found instanceof behaviors.LiveNowTimer ? found : undefined;
  }
}
