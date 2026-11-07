import { cleanup, screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { AppEvents } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { setTestFlags, testWithFlags } from '@grafana/test-utils/unstable';
import { appEvents } from 'app/core/app_events';

import { DashboardScene } from '../scene/DashboardScene';

import {
  isEditEntryBlocked,
  isMobileEditDeprecated,
  notifyMobileEditNotAvailable,
  redirectAwayFromMobileEdit,
  useIsMobileEditDeprecated,
} from './mobileEditDeprecation';
import {
  resetViewport,
  setMobileViewport,
  setNarrowDesktopViewport,
  testWithViewport,
} from './mobileViewportTestUtils';

const mockUseMediaQueryMinWidth = jest.fn();

jest.mock('app/core/hooks/useMediaQueryMinWidth', () => ({
  useMediaQueryMinWidth: () => mockUseMediaQueryMinWidth(),
}));

describe('isMobileEditDeprecated', () => {
  afterEach(() => {
    setTestFlags({});
  });

  it('is true when the toggle is on and the viewport is narrower than the sm breakpoint', () => {
    setTestFlags({ 'grafana.mobileEditDeprecation': true });
    setMobileViewport();

    expect(isMobileEditDeprecated()).toBe(true);
  });

  it('is false when the toggle is on but the viewport is at least the sm breakpoint', () => {
    setTestFlags({ 'grafana.mobileEditDeprecation': true });
    resetViewport();

    expect(isMobileEditDeprecated()).toBe(false);
  });

  it('is false on a mobile-sized viewport when the toggle is off', () => {
    setMobileViewport();

    expect(isMobileEditDeprecated()).toBe(false);
  });

  it('is false on a narrow viewport with a mouse-primary device, such as a zoomed desktop browser', () => {
    setTestFlags({ 'grafana.mobileEditDeprecation': true });
    setNarrowDesktopViewport();

    expect(isMobileEditDeprecated()).toBe(false);
  });
});

describe('isEditEntryBlocked', () => {
  function buildScene(state?: Partial<ConstructorParameters<typeof DashboardScene>[0]>) {
    return new DashboardScene({ title: 'hello', meta: { canEdit: true }, ...state });
  }

  testWithFlags({ 'grafana.mobileEditDeprecation': true });

  testWithViewport('mobile');

  it('blocks a dashboard that is not editing', () => {
    expect(isEditEntryBlocked(buildScene())).toBe(true);
  });

  it('does not block a session already in full editing, so a viewport change mid-session is harmless', () => {
    expect(isEditEntryBlocked(buildScene({ isEditing: true }))).toBe(false);
  });

  it('blocks a Viewing session, which is still isEditing but cannot switch back to Editing', () => {
    setTestFlags({
      dashboardNewLayouts: true,
      'grafana.dashboardPreviewMode': true,
      'grafana.mobileEditDeprecation': true,
    });

    expect(isEditEntryBlocked(buildScene({ isEditing: true, mode: 'view' }))).toBe(true);
  });

  it('does not block anything once the viewport is at least the sm breakpoint', () => {
    resetViewport();

    expect(isEditEntryBlocked(buildScene())).toBe(false);
  });
});

function Probe() {
  return <span>{useIsMobileEditDeprecated() ? 'blocked' : 'allowed'}</span>;
}

/** `render` from test-utils supplies the OpenFeatureProvider the flag hook needs. */
function setup({
  flag,
  isAtLeastSm,
  isTouchPrimary = true,
}: {
  flag: boolean;
  isAtLeastSm: boolean;
  isTouchPrimary?: boolean;
}) {
  setTestFlags({ 'grafana.mobileEditDeprecation': flag });
  mockUseMediaQueryMinWidth.mockReturnValue(isAtLeastSm);
  if (isTouchPrimary) {
    setMobileViewport();
  } else {
    setNarrowDesktopViewport();
  }
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

  it('is allowed below the sm breakpoint when the primary input is a mouse, such as a zoomed desktop browser', () => {
    setup({ flag: true, isAtLeastSm: false, isTouchPrimary: false });

    expect(screen.getByText('allowed')).toBeInTheDocument();
  });
});

describe('notifyMobileEditNotAvailable', () => {
  it('emits a warning toast explaining dashboard editing is unavailable on small screens', () => {
    const emitSpy = jest.spyOn(appEvents, 'emit');

    notifyMobileEditNotAvailable();

    expect(emitSpy).toHaveBeenCalledWith(AppEvents.alertWarning, [
      'Dashboard editing is not available on small screens. Switch to a larger screen to continue.',
    ]);
  });
});

describe('redirectAwayFromMobileEdit', () => {
  it('warns and redirects to /dashboards', () => {
    const emitSpy = jest.spyOn(appEvents, 'emit');
    const replaceSpy = jest.spyOn(locationService, 'replace').mockImplementation(() => {});

    redirectAwayFromMobileEdit();

    expect(emitSpy).toHaveBeenCalledWith(AppEvents.alertWarning, [
      'Dashboard editing is not available on small screens. Switch to a larger screen to continue.',
    ]);
    expect(replaceSpy).toHaveBeenCalledWith('/dashboards');
  });
});
