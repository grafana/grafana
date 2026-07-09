import { type Faro } from '@grafana/faro-core';
import { locationService } from '@grafana/runtime';

import { setupFaroPageMeta } from './faroPageMeta';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  locationService: {
    getLocation: jest.fn(),
    getHistory: jest.fn(),
  },
}));

const getLocationMock = jest.mocked(locationService.getLocation);
const getHistoryMock = jest.mocked(locationService.getHistory);

function setReferrer(value: string) {
  Object.defineProperty(document, 'referrer', { value, configurable: true });
}

describe('setupFaroPageMeta', () => {
  let setPage: jest.Mock;
  let faro: Faro;
  let navigate: (location: { pathname: string }) => void;

  beforeEach(() => {
    jest.clearAllMocks();

    setPage = jest.fn();
    faro = { api: { setPage } } as unknown as Faro;

    getLocationMock.mockReturnValue({ pathname: '/search' } as ReturnType<typeof locationService.getLocation>);
    getHistoryMock.mockReturnValue({
      listen: (listener: (location: { pathname: string }) => void) => {
        navigate = listener;
        return () => {};
      },
    } as unknown as ReturnType<typeof locationService.getHistory>);
  });

  it('attaches referrer and omits previousUrl on the landing page', () => {
    setReferrer('https://issues.example.com/123');

    setupFaroPageMeta(faro);

    expect(setPage).toHaveBeenCalledTimes(1);
    expect(setPage).toHaveBeenLastCalledWith({
      url: window.location.href,
      attributes: { referrer: 'https://issues.example.com/123' },
    });
  });

  it('reports the previous route as previousUrl on subsequent internal navigations', () => {
    setReferrer('https://issues.example.com/123');

    setupFaroPageMeta(faro);
    navigate({ pathname: '/d/abc' });

    expect(setPage).toHaveBeenCalledTimes(2);
    expect(setPage).toHaveBeenLastCalledWith({
      url: window.location.href,
      attributes: { referrer: 'https://issues.example.com/123', previousUrl: '/search' },
    });

    navigate({ pathname: '/d/xyz' });

    expect(setPage).toHaveBeenCalledTimes(3);
    expect(setPage).toHaveBeenLastCalledWith({
      url: window.location.href,
      attributes: { referrer: 'https://issues.example.com/123', previousUrl: '/d/abc' },
    });
  });

  it('does not overwrite previousUrl on query-param-only navigations that keep the same pathname', () => {
    setReferrer('https://issues.example.com/123');

    setupFaroPageMeta(faro);

    // Real navigation to a dashboard - previousUrl becomes the landing page.
    navigate({ pathname: '/d/abc' });
    expect(setPage).toHaveBeenLastCalledWith({
      url: window.location.href,
      attributes: { referrer: 'https://issues.example.com/123', previousUrl: '/search' },
    });

    // Query params settling (time range, variables) fire with the same pathname; previousUrl must
    // stay as '/search' rather than pointing '/d/abc' at itself.
    navigate({ pathname: '/d/abc' });
    expect(setPage).toHaveBeenLastCalledWith({
      url: window.location.href,
      attributes: { referrer: 'https://issues.example.com/123', previousUrl: '/search' },
    });

    // The next real navigation still reports the page the user actually came from.
    navigate({ pathname: '/d/xyz' });
    expect(setPage).toHaveBeenLastCalledWith({
      url: window.location.href,
      attributes: { referrer: 'https://issues.example.com/123', previousUrl: '/d/abc' },
    });
  });

  it('keeps the landing page as a session entry point after its query params settle', () => {
    setReferrer('https://issues.example.com/123');

    setupFaroPageMeta(faro);

    // The landing URL settling with query params must not introduce a self-referential previousUrl.
    navigate({ pathname: '/search' });

    expect(setPage).toHaveBeenLastCalledWith({
      url: window.location.href,
      attributes: { referrer: 'https://issues.example.com/123' },
    });
  });
});
