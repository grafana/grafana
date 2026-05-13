import type * as React from 'react';

import type { ElementState } from 'app/features/canvas/runtime/element';
import type { Scene } from 'app/features/canvas/runtime/scene';
import { findElementByTarget } from 'app/features/canvas/runtime/sceneElementManagement';

import { ConnectionPath, type CanvasConnection } from '../../panelcfg.gen';
import type { ConnectionState } from '../../types';
import * as canvasUtils from '../../utils';

import { ANCHORS, ANCHOR_PADDING, CONNECTION_ANCHOR_ALT, HALF_SIZE } from './ConnectionAnchors';
import { Connections } from './Connections';

jest.mock('app/features/canvas/runtime/sceneElementManagement', () => ({
  findElementByTarget: jest.fn(),
}));

const mockedFindElementByTarget = jest.mocked(findElementByTarget);

const rect = (partial: Partial<DOMRect> & Pick<DOMRect, 'top' | 'left'>): DOMRect =>
  ({
    width: partial.width ?? 1000,
    height: partial.height ?? 800,
    bottom: partial.bottom ?? partial.top + (partial.height ?? 800),
    right: partial.right ?? partial.left + (partial.width ?? 1000),
    x: partial.x ?? partial.left,
    y: partial.y ?? partial.top,
    toJSON() {
      return '';
    },
    ...partial,
  }) as DOMRect;

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
    let getParentBoundingClientRectSpy: jest.SpiedFunction<typeof canvasUtils.getParentBoundingClientRect>;

    beforeEach(() => {
      mockedFindElementByTarget.mockReset();
      getParentBoundingClientRectSpy = jest.spyOn(canvasUtils, 'getParentBoundingClientRect');
    });

    afterEach(() => {
      getParentBoundingClientRectSpy.mockRestore();
    });

    function createSceneTargetAndElement(sceneOpts?: { editingEnabled?: boolean; scale?: number }): {
      target: HTMLElement;
      mockElement: ElementState;
      sceneOverrides: Partial<Scene>;
    } {
      const sceneDiv = document.createElement('div');
      const target = document.createElement('div');
      sceneDiv.appendChild(target);

      const elementDiv = document.createElement('div');
      jest
        .spyOn(elementDiv, 'getBoundingClientRect')
        .mockReturnValue(rect({ top: 100, left: 200, width: 80, height: 40, bottom: 140, right: 280 }));

      const mockElement = {
        div: elementDiv,
        item: {},
      } as ElementState;

      const sceneOverrides: Partial<Scene> = {
        isEditingEnabled: sceneOpts?.editingEnabled ?? true,
        scale: sceneOpts?.scale ?? 1,
        div: sceneDiv,
        root: { elements: [] } as unknown as Scene['root'],
      };

      return { target, mockElement, sceneOverrides };
    }

    it('does nothing when the event target is not an Element', () => {
      const connections = newConnections({ isEditingEnabled: true });

      mockedFindElementByTarget.mockImplementation(() => {
        throw new Error('should not resolve element');
      });

      connections.handleMouseEnter({
        target: document.createTextNode('x'),
      } as unknown as React.MouseEvent<Element>);

      expect(connections.connectionSource).toBeUndefined();
      expect(connections.connectionTarget).toBeUndefined();
    });

    it('does nothing when inline editing is disabled', () => {
      const connections = newConnections({ isEditingEnabled: false });

      mockedFindElementByTarget.mockImplementation(() => {
        throw new Error('should not resolve element');
      });

      const target = document.createElement('div');
      connections.handleMouseEnter({ target } as unknown as React.MouseEvent<Element>);

      expect(mockedFindElementByTarget).not.toHaveBeenCalled();
    });

    it('does nothing when the pointer target is not on a canvas element', () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      const { target, sceneOverrides } = createSceneTargetAndElement();
      const c = newConnections({
        ...sceneOverrides,
      });

      mockedFindElementByTarget.mockReturnValue(undefined);

      c.handleMouseEnter({ target } as unknown as React.MouseEvent<Element>);

      expect(logSpy).toHaveBeenCalledWith('no element');

      logSpy.mockRestore();
    });

    it('stores connectionSource, positions anchors, and shows the highlight frame when hovering an element while not drawing', () => {
      const { target, mockElement, sceneOverrides } = createSceneTargetAndElement({ scale: 2 });

      getParentBoundingClientRectSpy.mockReturnValue(
        rect({ top: 10, left: 20, width: 1000, height: 800, bottom: 810, right: 1020 })
      );

      mockedFindElementByTarget.mockReturnValue(mockElement);

      const connections = newConnections(sceneOverrides);

      const connectionAnchorDiv = document.createElement('div');
      connections.connectionAnchorDiv = connectionAnchorDiv;

      const anchorsDiv = document.createElement('div');
      ANCHORS.forEach(() => {
        anchorsDiv.appendChild(document.createElement('div'));
      });
      connections.anchorsDiv = anchorsDiv;

      connections.handleMouseEnter({ target } as unknown as React.MouseEvent<Element>);

      expect(getParentBoundingClientRectSpy).toHaveBeenCalled();
      expect(connections.connectionSource).toBe(mockElement);
      expect(connections.connectionTarget).toBeUndefined();

      const firstAnchor = anchorsDiv.children[0] as HTMLElement;
      expect(firstAnchor.style.top).toBe(`calc(${-ANCHORS[0].y * 50 + 50}% - ${HALF_SIZE}px - ${ANCHOR_PADDING}px)`);
      expect(firstAnchor.style.left).toBe(`calc(${ANCHORS[0].x * 50 + 50}% - ${HALF_SIZE}px - ${ANCHOR_PADDING}px)`);

      expect(connectionAnchorDiv.style.top).toBe('45px');
      expect(connectionAnchorDiv.style.left).toBe('90px');
      expect(connectionAnchorDiv.style.width).toBe('40px');
      expect(connectionAnchorDiv.style.height).toBe('20px');
    });

    it('stores connectionTarget when a connection drag is already in progress', () => {
      const { target, mockElement, sceneOverrides } = createSceneTargetAndElement();

      getParentBoundingClientRectSpy.mockReturnValue(rect({ top: 0, left: 0, width: 100, height: 100 }));

      mockedFindElementByTarget.mockReturnValue(mockElement);

      const connections = newConnections(sceneOverrides);
      connections.connectionAnchorDiv = document.createElement('div');
      connections.anchorsDiv = document.createElement('div');
      connections.isDrawingConnection = true;

      connections.handleMouseEnter({ target } as unknown as React.MouseEvent<Element>);

      expect(connections.connectionTarget).toBe(mockElement);
      expect(connections.connectionSource).toBeUndefined();
    });

    it('hides anchors beyond customConnectionAnchors length', () => {
      const { target, mockElement, sceneOverrides } = createSceneTargetAndElement();
      getParentBoundingClientRectSpy.mockReturnValue(rect({ top: 0, left: 0, width: 500, height: 400 }));
      mockedFindElementByTarget.mockReturnValue(mockElement);

      mockElement.item = {
        customConnectionAnchors: [
          { x: 0, y: 1 },
          { x: 1, y: -1 },
        ],
      } as ElementState['item'];

      const connections = newConnections(sceneOverrides);
      connections.connectionAnchorDiv = document.createElement('div');
      const anchorsDiv = document.createElement('div');
      for (let i = 0; i < 3; i++) {
        anchorsDiv.appendChild(document.createElement('div'));
      }
      connections.anchorsDiv = anchorsDiv;

      connections.handleMouseEnter({ target } as unknown as React.MouseEvent<Element>);

      expect((anchorsDiv.children[0] as HTMLElement).style.display).toBe('block');
      expect((anchorsDiv.children[1] as HTMLElement).style.display).toBe('block');
      expect((anchorsDiv.children[2] as HTMLElement).style.display).toBe('none');
    });
  });

  describe('handleMouseLeave', () => {
    function setupConnectionsWithAnchors(connectionTargetFlag: boolean): Connections {
      const connections = newConnections();
      connections.connectionAnchorDiv = document.createElement('div');
      connections.connectionAnchorDiv.style.display = 'block';
      if (connectionTargetFlag) {
        connections.connectionTarget = { options: {} } as ElementState;
      }
      return connections;
    }

    it('returns false and keeps anchors visible when leaving into a connection-anchor image', () => {
      const connections = setupConnectionsWithAnchors(true);

      const img = document.createElement('img');
      img.setAttribute('alt', CONNECTION_ANCHOR_ALT);

      const result = connections.handleMouseLeave({
        relatedTarget: img,
      } as unknown as React.MouseEvent<Element>);

      expect(result).toBe(false);
      expect(connections.connectionTarget).toBeDefined();
      expect(connections.connectionAnchorDiv!.style.display).toBe('block');
    });

    it('returns true, clears connectionTarget, and hides the anchor overlay otherwise', () => {
      const connections = setupConnectionsWithAnchors(true);

      const unrelated = document.createElement('button');

      const result = connections.handleMouseLeave({
        relatedTarget: unrelated,
      } as unknown as React.MouseEvent<Element>);

      expect(result).toBe(true);
      expect(connections.connectionTarget).toBeUndefined();
      expect(connections.connectionAnchorDiv!.style.display).toBe('none');
    });

    it('treats an image with a different alt like a normal leave target', () => {
      const connections = setupConnectionsWithAnchors(true);

      const img = document.createElement('img');
      img.setAttribute('alt', 'not a connection anchor');

      const result = connections.handleMouseLeave({
        relatedTarget: img,
      } as unknown as React.MouseEvent<Element>);

      expect(result).toBe(true);
      expect(connections.connectionTarget).toBeUndefined();
      expect(connections.connectionAnchorDiv!.style.display).toBe('none');
    });
  });

  it.todo('handleConnectionDragStart');
  it.todo('handleVertexDragStart');
  it.todo('handleVertexAddDragStart');
  it.todo('onChange');
  it.todo('connectionsNeedUpdate');
  it.todo('renderElement');
});
