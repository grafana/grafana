import type { ElementState } from 'app/features/canvas/runtime/element';
import type { Scene } from 'app/features/canvas/runtime/scene';

import { ConnectionPath, type CanvasConnection } from '../../panelcfg.gen';
import type { ConnectionState } from '../../types';

import { Connections } from './Connections';

const getMockScene = (overrides?: Partial<Scene>): Scene =>
  ({
    byName: new Map(),
    ...overrides,
  }) as unknown as Scene;

const getMockConnectionState = (overrides?: Partial<ConnectionState>): ConnectionState => {
  const baseInfo: CanvasConnection = {
    path: ConnectionPath.Straight,
    source: { x: 0, y: 0 },
    target: { x: 0, y: 0 },
  };

  const base: ConnectionState = {
    index: 0,
    source: {} as ElementState,
    target: {} as ElementState,
    info: baseInfo,
  };

  return {
    ...base,
    ...overrides,
    info: {
      ...base.info,
      ...overrides?.info,
    },
  };
};

/** When `scene` is omitted, uses {@link getMockScene} defaults (`minimalScene({ … })` for overrides). */
const newConnections = (sceneOverrides?: Partial<Scene>): Connections => new Connections(getMockScene(sceneOverrides));

/** Discard the synchronous initial BehaviorSubject emission so only subsequent next() calls appear on the spy. */
const spyOnSelectionAfterInitial = (connections: Connections): jest.Mock => {
  const spy = jest.fn();
  connections.selection.subscribe(spy);
  spy.mockClear();
  return spy;
};

describe('Connections', () => {
  it('constructor', () => {
    let connections: Connections | undefined;

    expect(() => {
      connections = newConnections();
    }).not.toThrow();

    expect(connections).toBeDefined();
    expect(connections).toBeInstanceOf(Connections);
  });

  describe('select', () => {
    it('emits when the selection value changes', () => {
      const connections = newConnections();
      const connection = getMockConnectionState();

      connections.select(connection);
      expect(connections.selection.value).toBe(connection);
    });
    it('does not emit when the selection is unchanged', () => {
      const connections = newConnections();
      const connection = getMockConnectionState();
      const nextSpy = spyOnSelectionAfterInitial(connections);

      connections.select(undefined);
      expect(nextSpy).not.toHaveBeenCalled();

      connections.select(connection);
      expect(nextSpy).toHaveBeenCalledTimes(1);

      connections.select(connection);
      expect(nextSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleMouseEnter', () => {
    it.todo('handleMouseEnter');
  });

  it.todo('handleMouseLeave');
  it.todo('handleConnectionDragStart');
  it.todo('handleVertexDragStart');
  it.todo('handleVertexAddDragStart');
  it.todo('onChange');
  it.todo('connectionsNeedUpdate');
  it.todo('renderElement');
});
