import { render } from '@testing-library/react';

import { textUtil } from '@grafana/data';

import { isTrustedSVGSource, SanitizedSVG } from './SanitizedSVG';

const mockPreProcessors: Array<(code: string) => string> = [];

jest.mock('react-inlinesvg', () => (props: { preProcessor: (code: string) => string }) => {
  mockPreProcessors.push(props.preProcessor);
  return null;
});

const payload =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><style>body{outline:5px solid red}</style><image href="https://evil.example/img"/><filter><feImage href="https://evil.example/fe"/></filter><rect width="10" height="10"/></svg>';

const buildImg = 'public/build/img/';

describe('isTrustedSVGSource', () => {
  it.each([
    ['public/build/img/icons/unicons/cloud.svg'],
    [`/${buildImg}icons/unicons/cloud.svg`],
    [`${window.location.origin}/${buildImg}bg.svg`],
    [`public/${'img'}/icons/marker/circle.svg`],
  ])('trusts Grafana public assets: %s', (src) => {
    expect(isTrustedSVGSource(src)).toBe(true);
  });

  it.each([
    ['https://evil.example/icon.svg'],
    [`${window.location.origin}/api/somewhere.svg`],
    ['public/plugins/some-plugin/img/logo.svg'],
    ['public/build/../plugins/some-plugin/img/logo.svg'],
    ['data:image/svg+xml,%3Csvg%3E%3C/svg%3E'],
    [payload],
    [`public/build/${payload}`],
    [undefined],
  ])('does not trust %s', (src) => {
    expect(isTrustedSVGSource(src)).toBe(false);
  });
});

describe('sanitizeUntrustedSVGContent', () => {
  it('removes style, image and feImage but keeps the shapes', () => {
    const clean = textUtil.sanitizeUntrustedSVGContent(payload);
    expect(clean).not.toMatch(/<style|<image|<feImage|evil\.example/i);
    expect(clean).toContain('<rect');
  });

  it('removes attributes that let the root svg paint outside its box', () => {
    const overlay =
      '<svg xmlns="http://www.w3.org/2000/svg" style="position:fixed;inset:0;z-index:9999" transform="scale(100)" overflow="visible"><rect style="fill:red" width="10" height="10"/></svg>';
    const root = new DOMParser()
      .parseFromString(textUtil.sanitizeUntrustedSVGContent(overlay), 'text/html')
      .querySelector('svg');
    expect(root?.hasAttribute('style')).toBe(false);
    expect(root?.hasAttribute('transform')).toBe(false);
    expect(root?.hasAttribute('overflow')).toBe(false);
    expect(root?.querySelector('rect')?.getAttribute('style')).toBe('fill:red');
  });
});

describe('SanitizedSVG', () => {
  const lastPreProcessor = () => mockPreProcessors[mockPreProcessors.length - 1];

  beforeEach(() => {
    mockPreProcessors.length = 0;
  });

  it('strips <style> and <image> when src is inline markup', () => {
    render(<SanitizedSVG src={payload} />);
    expect(lastPreProcessor()(payload)).not.toMatch(/<style|<image/);
  });

  it('keeps <style> for Grafana public assets', () => {
    render(<SanitizedSVG src="public/build/img/icons/unicons/cloud.svg" />);
    expect(lastPreProcessor()(payload)).toContain('<style>');
  });

  it('passes the same preProcessor across re-renders', () => {
    const src = 'public/build/img/icons/unicons/cloud.svg';
    const { rerender } = render(<SanitizedSVG src={src} />);
    rerender(<SanitizedSVG src={src} className="other" />);
    expect(mockPreProcessors).toHaveLength(2);
    expect(mockPreProcessors[0]).toBe(mockPreProcessors[1]);
  });
});
