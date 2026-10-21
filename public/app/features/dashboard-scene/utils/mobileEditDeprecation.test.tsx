import { cleanup, screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { setTestFlags } from '@grafana/test-utils/unstable';

import { isMobileEditDeprecated, useIsMobileEditDeprecated } from './mobileEditDeprecation';

const mockUseMediaQueryMinWidth = jest.fn();

jest.mock('app/core/hooks/useMediaQueryMinWidth', () => ({
  useMediaQueryMinWidth: () => mockUseMediaQueryMinWidth(),
}));

describe('isMobileEditDeprecated', () => {
  afterEach(() => {
    setTestFlags({});
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
  });

  it('is true when the toggle is on and the viewport is narrower than the sm breakpoint', () => {
    setTestFlags({ 'grafana.mobileEditDeprecation': true });
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });

    expect(isMobileEditDeprecated()).toBe(true);
  });

  it('is false when the toggle is on but the viewport is at least the sm breakpoint', () => {
    setTestFlags({ 'grafana.mobileEditDeprecation': true });
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1200 });

    expect(isMobileEditDeprecated()).toBe(false);
  });

  it('is false on a mobile-sized viewport when the toggle is off', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });

    expect(isMobileEditDeprecated()).toBe(false);
  });
});

function Probe() {
  return <span>{useIsMobileEditDeprecated() ? 'blocked' : 'allowed'}</span>;
}

/** `render` from test-utils supplies the OpenFeatureProvider the flag hook needs. */
function setup({ flag, isAtLeastSm }: { flag: boolean; isAtLeastSm: boolean }) {
  setTestFlags({ 'grafana.mobileEditDeprecation': flag });
  mockUseMediaQueryMinWidth.mockReturnValue(isAtLeastSm);
  render(<Probe />);
}

describe('useIsMobileEditDeprecated', () => {
  afterEach(() => {
    cleanup();
    setTestFlags({});
    mockUseMediaQueryMinWidth.mockReset();
  });

  it('is blocked when the toggle is on and the viewport is below the sm breakpoint', () => {
    setup({ flag: true, isAtLeastSm: false });

    expect(screen.getByText('blocked')).toBeInTheDocument();
  });

  it('is allowed when the toggle is on but the viewport is at least the sm breakpoint', () => {
    setup({ flag: true, isAtLeastSm: true });

    expect(screen.getByText('allowed')).toBeInTheDocument();
  });

  it('is allowed on a mobile-sized viewport when the toggle is off', () => {
    setup({ flag: false, isAtLeastSm: false });

    expect(screen.getByText('allowed')).toBeInTheDocument();
  });
});
