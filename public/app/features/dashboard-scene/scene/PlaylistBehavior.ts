import { SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { playlistSrv } from 'app/features/playlist/PlaylistSrv';

interface PlaylistBehaviorState extends SceneObjectState {
  isPlaying?: boolean;
}

export class PlaylistBehavior extends SceneObjectBase<PlaylistBehaviorState> {
  constructor(state: PlaylistBehaviorState) {
    super(state);

    this.addActivationHandler(this._activationHandler.bind(this));
  }

  private _activationHandler() {
    this.setState({ isPlaying: playlistSrv.isPlaying });
  }

  next() {
    playlistSrv.next();
  }

  prev() {
    playlistSrv.prev();
  }

  stop() {
    playlistSrv.stop();
    this.setState({ isPlaying: false });
  }
}
