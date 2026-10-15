import { locationService } from '@grafana/runtime';

import { getTraceViewLinkAttrs, openTraceViewHref } from './openTraceViewHref';

describe('getTraceViewLinkAttrs', () => {
  it('keeps Grafana paths in the same tab', () => {
    expect(getTraceViewLinkAttrs('/explore?left=abc')).toEqual({
      href: '/explore?left=abc',
      target: '_self',
    });
  });

  it('opens other origins in a new tab', () => {
    expect(getTraceViewLinkAttrs('https://example.com/trace-details')).toEqual({
      href: 'https://example.com/trace-details',
      target: '_blank',
      rel: 'noopener noreferrer',
    });
  });

  it('does not expose javascript URLs', () => {
    expect(getTraceViewLinkAttrs('javascript:alert(1)')).toBeUndefined();
  });
});

describe('openTraceViewHref', () => {
  const pushSpy = jest.spyOn(locationService, 'push').mockImplementation(() => {});
  const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);

  afterEach(() => {
    pushSpy.mockClear();
    openSpy.mockClear();
  });

  afterAll(() => {
    pushSpy.mockRestore();
    openSpy.mockRestore();
  });

  it('pushes Grafana paths in the same tab', () => {
    openTraceViewHref('/explore?left=abc');

    expect(pushSpy).toHaveBeenCalledWith('/explore?left=abc');
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('pushes same-origin absolute URLs without the origin', () => {
    openTraceViewHref(`${window.location.origin}/a/grafana-pyroscope-app`);

    expect(pushSpy).toHaveBeenCalledWith('/a/grafana-pyroscope-app');
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('opens other origins in a new tab', () => {
    openTraceViewHref('https://example.com/trace-details');

    expect(openSpy).toHaveBeenCalledWith('https://example.com/trace-details', '_blank', 'noopener,noreferrer');
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('opens protocol-relative URLs in a new tab instead of pushing them', () => {
    openTraceViewHref('//example.com/trace-details');

    expect(openSpy).toHaveBeenCalledWith(
      `${window.location.protocol}//example.com/trace-details`,
      '_blank',
      'noopener,noreferrer'
    );
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('does not navigate javascript or mailto URLs', () => {
    openTraceViewHref('javascript:alert(1)');
    openTraceViewHref('mailto:ops@example.com');

    expect(pushSpy).not.toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();
  });
});
