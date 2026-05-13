import type * as React from 'react';
import { render, screen } from 'test/test-utils';

import type { ElementState } from 'app/features/canvas/runtime/element';
import type { Scene } from 'app/features/canvas/runtime/scene';
import { findElementByTarget } from 'app/features/canvas/runtime/sceneElementManagement';

import { ConnectionPath, type CanvasConnection } from '../../panelcfg.gen';
import type { ConnectionState } from '../../types';
import * as canvasUtils from '../../utils';

import {
  ANCHORS,
  ANCHOR_PADDING,
  CONNECTION_ANCHOR_ALT,
  CONNECTION_ANCHOR_DIV_ID,
  CONNECTION_ANCHOR_HIGHLIGHT_OFFSET,
  HALF_SIZE,
} from './ConnectionAnchors';
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

function setupConnectionsWithSelectorRoot(): {
  connections: Connections;
  rootContainer: HTMLElement;
  target: HTMLDivElement;
} {
  const rootContainer = document.createElement('div');
  jest.spyOn(rootContainer, 'addEventListener');

  const connections = newConnections({
    selecto: { rootContainer } as unknown as Scene['selecto'],
  });

  const target = document.createElement('div');
  return { connections, rootContainer, target };
}

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

  describe('handleConnectionDragStart', () => {
    let getParentBoundingClientRectSpy: jest.SpiedFunction<typeof canvasUtils.getParentBoundingClientRect>;

    beforeEach(() => {
      getParentBoundingClientRectSpy = jest.spyOn(canvasUtils, 'getParentBoundingClientRect');
    });

    afterEach(() => {
      getParentBoundingClientRectSpy.mockRestore();
    });

    function setupConnectionsForDragStart(opts?: { omitConnectionSvg?: boolean; omitConnectionLine?: boolean }): {
      connections: Connections;
      rootContainer: HTMLDivElement;
      selectedTarget: HTMLDivElement;
      connectionLine: SVGLineElement | undefined;
    } {
      const sceneDivParent = document.createElement('div');
      const sceneDiv = document.createElement('div');
      sceneDivParent.appendChild(sceneDiv);

      const rootContainer = document.createElement('div');
      jest.spyOn(rootContainer, 'addEventListener');

      const svgNs = 'http://www.w3.org/2000/svg';
      const connectionSVG =
        opts?.omitConnectionSvg === true ? undefined : (document.createElementNS(svgNs, 'svg') as SVGElement);
      const connectionLine =
        opts?.omitConnectionLine === true
          ? undefined
          : (document.createElementNS(svgNs, 'line') as unknown as SVGLineElement);

      const connections = newConnections({
        scale: 2,
        div: sceneDiv,
        selecto: { rootContainer } as unknown as Scene['selecto'],
      });
      connections.connectionSVG = connectionSVG;
      connections.connectionLine = connectionLine;

      const selectedTarget = document.createElement('div');
      jest
        .spyOn(selectedTarget, 'getBoundingClientRect')
        .mockReturnValue(rect({ top: 120, left: 150, width: 40, height: 40, bottom: 160, right: 190 }));

      return { connections, rootContainer, selectedTarget, connectionLine };
    }

    it('sets crosshair cursor, primes the connection line from the anchor rect, resets leave highlight flag, and subscribes to mousemove', () => {
      const parentBounds = rect({ top: 50, left: 100, width: 800, height: 600, bottom: 650, right: 900 });
      getParentBoundingClientRectSpy.mockReturnValue(parentBounds);

      const { connections, rootContainer, selectedTarget, connectionLine } = setupConnectionsForDragStart();
      const setAttributeSpy = jest.spyOn(connectionLine!, 'setAttribute');
      connections.didConnectionLeaveHighlight = true;

      const clientX = 440;
      const clientY = 390;
      const scale = connections.scene.scale;
      const offset = CONNECTION_ANCHOR_HIGHLIGHT_OFFSET * scale;
      const anchor = selectedTarget.getBoundingClientRect();

      connections.handleConnectionDragStart(selectedTarget, clientX, clientY);

      expect(rootContainer.style.cursor).toBe('crosshair');
      expect(connections.didConnectionLeaveHighlight).toBe(false);

      expect(setAttributeSpy.mock.calls.map(([attr, val]) => [attr, val])).toEqual([
        ['x1', `${(anchor.x - parentBounds.x + offset) / scale}`],
        ['y1', `${(anchor.y - parentBounds.y + offset) / scale}`],
        ['x2', `${clientX - parentBounds.x}`],
        ['y2', `${clientY - parentBounds.y}`],
      ]);

      expect(rootContainer.addEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
    });

    it('returns early without attaching mousemove when the parent bounding rect cannot be computed', () => {
      const { connections, rootContainer, selectedTarget, connectionLine } = setupConnectionsForDragStart();
      getParentBoundingClientRectSpy.mockReturnValue(undefined);

      const setAttrSpy = jest.spyOn(connectionLine!, 'setAttribute');

      connections.handleConnectionDragStart(selectedTarget, 0, 0);

      expect(rootContainer.style.cursor).toBe('crosshair');
      expect(setAttrSpy).not.toHaveBeenCalled();
      expect(rootContainer.addEventListener).not.toHaveBeenCalled();
    });

    it('still attaches the mousemove listener when SVG / line prerequisites are missing', () => {
      getParentBoundingClientRectSpy.mockReturnValue(rect({ top: 0, left: 0, width: 100, height: 100 }));

      const { connections, rootContainer, selectedTarget } = setupConnectionsForDragStart({
        omitConnectionSvg: true,
        omitConnectionLine: true,
      });

      connections.handleConnectionDragStart(selectedTarget, 10, 20);

      expect(rootContainer.style.cursor).toBe('crosshair');
      expect(rootContainer.addEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
    });
  });

  describe('handleVertexDragStart', () => {
    it('reads data-index onto selectedVertexIndex and registers mousemove/mouseup with the same listener', () => {
      const { connections, rootContainer, target } = setupConnectionsWithSelectorRoot();
      target.setAttribute('data-index', '2');

      connections.handleVertexDragStart(target);

      expect(connections.selectedVertexIndex).toBe(2);

      expect(rootContainer.addEventListener).toHaveBeenCalledTimes(2);

      const listenerFromMove = (jest
        .mocked(rootContainer.addEventListener)
        .mock.calls.find((c) => c[0] === 'mousemove') ?? [])[1] as EventListener;
      const listenerFromUp = (jest.mocked(rootContainer.addEventListener).mock.calls.find((c) => c[0] === 'mouseup') ??
        [])[1] as EventListener;

      expect(listenerFromMove).toBe(listenerFromUp);
    });

    it('uses 0 for selectedVertexIndex when data-index is absent (Number(null))', () => {
      const { connections, rootContainer, target } = setupConnectionsWithSelectorRoot();

      connections.handleVertexDragStart(target);

      expect(connections.selectedVertexIndex).toBe(0);
      expect(rootContainer.addEventListener).toHaveBeenCalledTimes(2);
    });

    it('does not throw when selecto or rootContainer is missing; still sets selectedVertexIndex', () => {
      const connections = newConnections();
      const target = document.createElement('div');
      target.setAttribute('data-index', '1');

      expect(() => connections.handleVertexDragStart(target)).not.toThrow();
      expect(connections.selectedVertexIndex).toBe(1);
    });
  });

  describe('handleVertexAddDragStart', () => {
    it('reads data-index onto selectedVertexIndex and registers mousemove/mouseup with the same listener', () => {
      const { connections, rootContainer, target } = setupConnectionsWithSelectorRoot();
      target.setAttribute('data-index', '4');

      connections.handleVertexAddDragStart(target);

      expect(connections.selectedVertexIndex).toBe(4);
      expect(rootContainer.addEventListener).toHaveBeenCalledTimes(2);

      const moveListener = jest
        .mocked(rootContainer.addEventListener)
        .mock.calls.find((c) => c[0] === 'mousemove')?.[1];
      const upListener = jest.mocked(rootContainer.addEventListener).mock.calls.find((c) => c[0] === 'mouseup')?.[1];
      expect(moveListener).toBeDefined();
      expect(upListener).toBe(moveListener);
    });

    it('uses 0 for selectedVertexIndex when data-index is absent', () => {
      const { connections, rootContainer, target } = setupConnectionsWithSelectorRoot();

      connections.handleVertexAddDragStart(target);

      expect(connections.selectedVertexIndex).toBe(0);
      expect(rootContainer.addEventListener).toHaveBeenCalledTimes(2);
    });

    it('does not throw when selector or rootContainer is missing; still sets selectedVertexIndex', () => {
      const connections = newConnections();
      const target = document.createElement('div');
      target.setAttribute('data-index', '3');

      expect(() => connections.handleVertexAddDragStart(target)).not.toThrow();
      expect(connections.selectedVertexIndex).toBe(3);
    });

    it('registers vertexAddListener, not the same references as handleVertexDragStart', () => {
      const drag = setupConnectionsWithSelectorRoot();
      drag.connections.handleVertexDragStart(drag.target);
      const dragMove = jest
        .mocked(drag.rootContainer.addEventListener)
        .mock.calls.find((c) => c[0] === 'mousemove')?.[1];

      const add = setupConnectionsWithSelectorRoot();
      add.connections.handleVertexAddDragStart(add.target);
      const addMove = jest.mocked(add.rootContainer.addEventListener).mock.calls.find((c) => c[0] === 'mousemove')?.[1];

      expect(addMove).toBeDefined();
      expect(dragMove).not.toBe(addMove);
    });
  });

  describe('onChange', () => {
    let getConnectionsSpy: jest.SpiedFunction<typeof canvasUtils.getConnections>;

    beforeEach(() => {
      getConnectionsSpy = jest.spyOn(canvasUtils, 'getConnections').mockReturnValue([]);
    });

    afterEach(() => {
      getConnectionsSpy.mockRestore();
    });

    it('replaces the connection at current.index, calls source.onChange with the new list, and refreshes state', () => {
      const first: CanvasConnection = {
        path: ConnectionPath.Straight,
        source: { x: 0, y: 0 },
        target: { x: 1, y: 1 },
      };
      const second: CanvasConnection = {
        path: ConnectionPath.Straight,
        source: { x: 2, y: 2 },
        target: { x: 3, y: 3 },
      };
      const connectionsArr: CanvasConnection[] = [first, second];

      const sourceOnChange = jest.fn();
      const mockSource = {
        onChange: sourceOnChange,
        options: {
          name: 'el-a',
          connections: connectionsArr,
        },
      } as unknown as ElementState;

      const current = getMockConnectionState({
        source: mockSource,
        index: 1,
        info: second,
      });

      const update: CanvasConnection = {
        path: ConnectionPath.Straight,
        source: { x: 8, y: 8 },
        target: { x: 9, y: 9 },
      };

      const connections = newConnections();
      connections.onChange(current, update);

      expect(sourceOnChange).toHaveBeenCalledTimes(1);
      expect(sourceOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'el-a',
          connections: [first, update],
        })
      );
      expect(getConnectionsSpy).toHaveBeenCalled();
      expect(connections.state).toEqual([]);
    });

    it('starts from an empty list when options.connections is undefined', () => {
      const sourceOnChange = jest.fn();
      const mockSource = {
        onChange: sourceOnChange,
        options: { label: 'no-conns-yet' },
      } as unknown as ElementState;

      const update: CanvasConnection = {
        path: ConnectionPath.Straight,
        source: { x: 1, y: 0 },
        target: { x: 0, y: 1 },
      };

      const current = getMockConnectionState({
        source: mockSource,
        index: 0,
        info: update,
      });

      newConnections().onChange(current, update);

      expect(sourceOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'no-conns-yet',
          connections: [update],
        })
      );
    });
  });

  describe('connectionsNeedUpdate', () => {
    function connectionTo(name: string): CanvasConnection {
      return {
        path: ConnectionPath.Straight,
        source: { x: 0, y: 0 },
        target: { x: 1, y: 1 },
        targetName: name,
      };
    }

    it('returns true when the element is a connection source', () => {
      const el = {
        options: {
          connections: [connectionTo('other')],
        },
      } as unknown as ElementState;

      expect(newConnections().connectionsNeedUpdate(el)).toBe(true);
    });

    it('returns true when the element is only a connection target', () => {
      const targetEl = {
        options: {},
      } as unknown as ElementState;

      const sourceEl = {
        options: {
          connections: [connectionTo('target-id')],
        },
      } as unknown as ElementState;

      const byName = new Map<string, ElementState>([
        ['target-id', targetEl],
        ['source-id', sourceEl],
      ]);

      expect(
        newConnections({
          byName,
        }).connectionsNeedUpdate(targetEl)
      ).toBe(true);
    });

    it('returns false when the element has no outgoing connections and is not targeted', () => {
      const orphan = {
        options: {},
      } as unknown as ElementState;

      const sourceEl = {
        options: {
          connections: [connectionTo('someone-else')],
        },
      } as unknown as ElementState;

      const someoneElse = {
        options: {},
      } as unknown as ElementState;

      const byName = new Map<string, ElementState>([
        ['orphan', orphan],
        ['source-id', sourceEl],
        ['someone-else', someoneElse],
      ]);

      expect(
        newConnections({
          byName,
        }).connectionsNeedUpdate(orphan)
      ).toBe(false);
    });

    it('returns false when connections is an empty array', () => {
      const el = {
        options: {
          connections: [],
        },
      } as unknown as ElementState;

      const byName = new Map<string, ElementState>([['el', el]]);
      expect(
        newConnections({
          byName,
        }).connectionsNeedUpdate(el)
      ).toBe(false);
    });
  });

  describe('renderElement', () => {
    it('renders anchor controls and the static connection SVG editor layers', () => {
      const scene = getMockScene({
        byName: new Map(),
        scale: 1,
        isEditingEnabled: true,
        panel: {
          context: {
            instanceState: {
              selectedConnection: undefined,
            },
          },
        },
      } as Partial<Scene>);

      const connections = new Connections(scene);
      (scene as { connections: Connections }).connections = connections;

      render(<>{connections.renderElement()}</>, { renderWithRouter: false });

      expect(document.getElementById(CONNECTION_ANCHOR_DIV_ID)).not.toBeNull();
      expect(screen.getAllByRole('img', { name: CONNECTION_ANCHOR_ALT, hidden: true })).toHaveLength(ANCHORS.length);
      expect(document.querySelectorAll('svg')).toHaveLength(2);
    });
  });
});
