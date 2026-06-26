import {
  DATAPOINT_CONTEXT_MESSAGE_TYPE,
  emitDatapointContextToParent,
  getDatapointEmbedTarget,
} from './emitDatapointContext';

const realParent = window.parent;

function setEmbedded(parent: Window | object) {
  Object.defineProperty(window, 'parent', { value: parent, configurable: true });
}

function setSearch(search: string) {
  window.history.replaceState({}, '', `/${search}`);
}

describe('getDatapointEmbedTarget', () => {
  afterEach(() => {
    Object.defineProperty(window, 'parent', { value: realParent, configurable: true });
    setSearch('');
  });

  it('returns null when not embedded, even with the param set', () => {
    setSearch('?assistantContextTarget=https://host.example');
    expect(getDatapointEmbedTarget()).toBeNull();
  });

  it('returns null when embedded but the param is absent', () => {
    setEmbedded({ postMessage: jest.fn() });
    setSearch('');
    expect(getDatapointEmbedTarget()).toBeNull();
  });

  it('returns the origin when embedded and the param is a valid URL', () => {
    setEmbedded({ postMessage: jest.fn() });
    setSearch('?assistantContextTarget=https://host.example:8443/app');
    expect(getDatapointEmbedTarget()).toBe('https://host.example:8443');
  });

  it('returns null when embedded and the param is not a valid URL', () => {
    setEmbedded({ postMessage: jest.fn() });
    setSearch('?assistantContextTarget=not-a-url');
    expect(getDatapointEmbedTarget()).toBeNull();
  });

  it('returns "*" when embedded and the host opts in with a wildcard (opaque origin)', () => {
    setEmbedded({ postMessage: jest.fn() });
    setSearch('?assistantContextTarget=*');
    expect(getDatapointEmbedTarget()).toBe('*');
  });
});

describe('emitDatapointContextToParent', () => {
  afterEach(() => {
    Object.defineProperty(window, 'parent', { value: realParent, configurable: true });
  });

  it('posts a versioned message to the parent at the given origin', () => {
    const postMessage = jest.fn();
    setEmbedded({ postMessage });

    const context = [{ title: 'Point', icon: 'crosshair' as const, data: { kind: 'timeseries-datapoint' } }];
    emitDatapointContextToParent(context, 'https://host.example');

    expect(postMessage).toHaveBeenCalledWith(
      {
        type: DATAPOINT_CONTEXT_MESSAGE_TYPE,
        version: 1,
        source: 'grafana',
        origin: 'grafana/panel-tooltip',
        context,
      },
      'https://host.example'
    );
  });
});
