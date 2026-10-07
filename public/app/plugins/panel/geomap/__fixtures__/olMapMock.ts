type MapEventHandler = (...args: unknown[]) => void;

export interface MockMap {
  map: {
    on: jest.Mock;
    un: jest.Mock;
    getView: jest.Mock;
    setView: jest.Mock;
    addLayer: jest.Mock;
    removeLayer: jest.Mock;
    addInteraction: jest.Mock;
    removeInteraction: jest.Mock;
    addControl: jest.Mock;
    getControls: jest.Mock;
    getLayers: jest.Mock;
    getViewport: jest.Mock;
    getSize: jest.Mock;
    updateSize: jest.Mock;
    dispose: jest.Mock;
  };
  view: {
    getZoom: jest.Mock;
    getCenter: jest.Mock;
    getProjection: jest.Mock;
  };
  handlers: Map<string, MapEventHandler[]>;
  fire: (type: string, ...args: unknown[]) => void;
  setView: (next: Partial<{ zoom: number; center: [number, number]; projection: string }>) => void;
}

/**
 * Stub OpenLayers Map for tests. Captures handlers registered via map.on(type, fn) so tests can
 * trigger them via fire(type, ...args). Method shapes are intentionally loose (jest.Mock) — tests
 * cast the returned `map` to `Map` at the call site where needed.
 */
export function createMockMap(initialView?: {
  zoom?: number;
  center?: [number, number];
  projection?: string;
}): MockMap {
  const handlers = new Map<string, MapEventHandler[]>();

  let zoom = initialView?.zoom;
  let center: [number, number] | undefined = initialView?.center ?? [0, 0];
  let projection = initialView?.projection ?? 'EPSG:3857';

  const view = {
    getZoom: jest.fn(() => zoom),
    getCenter: jest.fn(() => center),
    getProjection: jest.fn(() => projection),
  };

  const map = {
    on: jest.fn((type: string, fn: MapEventHandler) => {
      const list = handlers.get(type) ?? [];
      list.push(fn);
      handlers.set(type, list);
      return { listener: fn };
    }),
    un: jest.fn((type: string, fn: MapEventHandler) => {
      const list = handlers.get(type);
      if (!list) {
        return;
      }
      const idx = list.indexOf(fn);
      if (idx >= 0) {
        list.splice(idx, 1);
      }
    }),
    getView: jest.fn(() => view),
    setView: jest.fn(),
    addLayer: jest.fn(),
    removeLayer: jest.fn(),
    addInteraction: jest.fn(),
    removeInteraction: jest.fn(),
    addControl: jest.fn(),
    getControls: jest.fn(() => ({ clear: jest.fn() })),
    getLayers: jest.fn(() => ({ forEach: jest.fn(), getLength: () => 0, item: () => undefined, setAt: jest.fn() })),
    getViewport: jest.fn(() => document.createElement('div')),
    getSize: jest.fn(() => [800, 600]),
    updateSize: jest.fn(),
    dispose: jest.fn(),
  };

  return {
    map,
    view,
    handlers,
    fire(type: string, ...args: unknown[]) {
      const list = handlers.get(type);
      if (!list) {
        return;
      }
      for (const fn of list) {
        fn(...args);
      }
    },
    setView(next) {
      if (next.zoom !== undefined) {
        zoom = next.zoom;
      }
      if (next.center !== undefined) {
        center = next.center;
      }
      if (next.projection !== undefined) {
        projection = next.projection;
      }
    },
  };
}
