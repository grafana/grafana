import { EchoEventType, MAX_PAGE_URL_LENGTH, TRUNCATION_MARKER } from '@grafana/runtime';

import { Echo } from './Echo';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  MAX_PAGE_URL_LENGTH: 2048,
  TRUNCATION_MARKER: '[url too long]',
}));

jest.mock('../context_srv', () => ({
  contextSrv: {
    user: { id: 1, login: 'admin', isSignedIn: true, orgRole: 'Admin', orgId: 1 },
  },
}));

describe('Echo.getMeta URL truncation', () => {
  it('returns the full href when it is within the length limit', () => {
    const shortUrl = 'http://localhost:3000/d/abc?var-cluster=prod';
    Object.defineProperty(window, 'location', {
      value: { ...window.location, href: shortUrl, pathname: '/d/abc' },
      writable: true,
    });

    const echo = new Echo();
    const meta = echo.getMeta();

    expect(meta.url).toBe(shortUrl);
  });

  it('truncates href and appends the marker when it exceeds MAX_PAGE_URL_LENGTH', () => {
    const longHref = 'http://localhost:3000/d/abc?' + 'x'.repeat(MAX_PAGE_URL_LENGTH);
    Object.defineProperty(window, 'location', {
      value: { ...window.location, href: longHref, pathname: '/d/abc' },
      writable: true,
    });

    const echo = new Echo();
    const meta = echo.getMeta();
    const url = meta.url ?? '';

    expect(url.length).toBe(MAX_PAGE_URL_LENGTH);
    expect(url.endsWith(TRUNCATION_MARKER)).toBe(true);
  });
});

describe('Echo onInteraction', () => {
  let echo: Echo;

  beforeEach(() => {
    echo = new Echo({ flushInterval: 999_999 });
  });

  it('should call subscriber when matching interaction is added', () => {
    const callback = jest.fn();
    echo.onInteraction('test_interaction', callback);

    echo.addEvent({
      type: EchoEventType.Interaction,
      payload: {
        interactionName: 'test_interaction',
        properties: { key: 'value' },
      },
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({ key: 'value' });
  });

  it('should not call subscriber for non-matching interaction name', () => {
    const callback = jest.fn();
    echo.onInteraction('test_interaction', callback);

    echo.addEvent({
      type: EchoEventType.Interaction,
      payload: {
        interactionName: 'other_interaction',
        properties: { key: 'value' },
      },
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('should not call subscriber for non-interaction events', () => {
    const callback = jest.fn();
    echo.onInteraction('test_interaction', callback);

    echo.addEvent({
      type: EchoEventType.Pageview,
      payload: { page: '/test' },
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('should support multiple subscribers for the same interaction', () => {
    const callback1 = jest.fn();
    const callback2 = jest.fn();
    echo.onInteraction('test_interaction', callback1);
    echo.onInteraction('test_interaction', callback2);

    echo.addEvent({
      type: EchoEventType.Interaction,
      payload: {
        interactionName: 'test_interaction',
        properties: { key: 'value' },
      },
    });

    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);
  });

  it('should unsubscribe when returned function is called', () => {
    const callback = jest.fn();
    const unsub = echo.onInteraction('test_interaction', callback);

    echo.addEvent({
      type: EchoEventType.Interaction,
      payload: { interactionName: 'test_interaction', properties: {} },
    });
    expect(callback).toHaveBeenCalledTimes(1);

    unsub();

    echo.addEvent({
      type: EchoEventType.Interaction,
      payload: { interactionName: 'test_interaction', properties: {} },
    });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should pass empty object when properties is undefined', () => {
    const callback = jest.fn();
    echo.onInteraction('test_interaction', callback);

    echo.addEvent({
      type: EchoEventType.Interaction,
      payload: { interactionName: 'test_interaction' },
    });

    expect(callback).toHaveBeenCalledWith({});
  });

  it('should not throw when subscriber throws', () => {
    const errorCallback = jest.fn(() => {
      throw new Error('subscriber error');
    });
    const goodCallback = jest.fn();

    echo.onInteraction('test_interaction', errorCallback);
    echo.onInteraction('test_interaction', goodCallback);

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    echo.addEvent({
      type: EchoEventType.Interaction,
      payload: { interactionName: 'test_interaction', properties: {} },
    });

    expect(errorCallback).toHaveBeenCalledTimes(1);
    expect(goodCallback).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('should still dispatch to backends alongside subscriber dispatch', () => {
    const mockBackend = {
      options: {},
      supportedEvents: [EchoEventType.Interaction],
      flush: jest.fn(),
      addEvent: jest.fn(),
    };
    echo.addBackend(mockBackend);

    const callback = jest.fn();
    echo.onInteraction('test_interaction', callback);

    echo.addEvent({
      type: EchoEventType.Interaction,
      payload: { interactionName: 'test_interaction', properties: { a: 1 } },
    });

    expect(mockBackend.addEvent).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should fire onInteraction subscribers for silent interactions', () => {
    const callback = jest.fn();
    echo.onInteraction('silent_event', callback);

    echo.addEvent({
      type: EchoEventType.Interaction,
      payload: { interactionName: 'silent_event', properties: { key: 'val' }, silent: true },
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({ key: 'val' });
  });

  it('should NOT dispatch silent interactions to backends', () => {
    const mockBackend = {
      options: {},
      supportedEvents: [EchoEventType.Interaction],
      flush: jest.fn(),
      addEvent: jest.fn(),
    };
    echo.addBackend(mockBackend);

    echo.addEvent({
      type: EchoEventType.Interaction,
      payload: { interactionName: 'silent_event', properties: {}, silent: true },
    });

    expect(mockBackend.addEvent).not.toHaveBeenCalled();
  });
});
