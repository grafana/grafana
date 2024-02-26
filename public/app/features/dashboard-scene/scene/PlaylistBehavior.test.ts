import { SceneGridItem, SceneGridLayout, VizPanel } from '@grafana/scenes';
import { playlistSrv } from 'app/features/playlist/PlaylistSrv';

import { DashboardScene } from './DashboardScene';
import { PlaylistBehavior } from './PlaylistBehavior';

jest.mock('app/features/playlist/PlaylistSrv', () => ({
  playlistSrv: {
    isPlaying: true,
    start: jest.fn(),
    next: jest.fn(),
    prev: jest.fn(),
    stop: jest.fn(),
  },
}));

describe('PlaylistBehavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    playlistSrv.isPlaying = true;
  });

  it.each([true, false])('should set isPlaying to the playingSrv.isPlaying when activated', async (isPlaying) => {
    playlistSrv.isPlaying = isPlaying;
    const { behavior } = await buildTestScene();

    expect(behavior.state.isPlaying).toBe(isPlaying);
  });

  it('should call playlistSrv.next() when next() is called', async () => {
    const { behavior } = await buildTestScene();
    behavior.next();
    expect(playlistSrv.next).toHaveBeenCalled();
  });

  it('should call playlistSrv.prev() when prev() is called', async () => {
    const { behavior } = await buildTestScene();
    behavior.prev();
    expect(playlistSrv.prev).toHaveBeenCalled();
  });

  it('should call playlistSrv.stop() when stop() is called', async () => {
    const { behavior } = await buildTestScene();
    behavior.stop();
    expect(playlistSrv.stop).toHaveBeenCalled();
    expect(behavior.state.isPlaying).toBe(false);
  });
});

async function buildTestScene() {
  const behavior = new PlaylistBehavior({});
  const scene = new DashboardScene({
    title: 'My dashboard',
    uid: 'dash-1',
    $behaviors: [behavior],
    body: new SceneGridLayout({
      children: [
        new SceneGridItem({
          key: 'griditem-1',
          x: 0,
          y: 0,
          width: 10,
          height: 12,
          body: new VizPanel({
            title: 'Panel A',
            key: 'panel-1',
            pluginId: 'table',
          }),
        }),
      ],
    }),
  });

  scene.activate();

  return { scene, behavior };
}
