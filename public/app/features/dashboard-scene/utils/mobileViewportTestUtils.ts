import { TOUCH_PRIMARY_QUERY } from './mobileEditDeprecation';

const DESKTOP_WIDTH = 1024;
const MOBILE_WIDTH = 375;

const originalMatchMedia = window.matchMedia;

function setInnerWidth(value: number) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value });
}

function stubMatchMedia(touchPrimary: boolean) {
  window.matchMedia = (query: string) => ({
    ...originalMatchMedia(query),
    matches: touchPrimary && query === TOUCH_PRIMARY_QUERY,
  });
}

/** A phone: narrow viewport with a touch-primary input device. */
export function setMobileViewport() {
  setInnerWidth(MOBILE_WIDTH);
  stubMatchMedia(true);
}

/** A desktop window dragged narrow, or zoomed in: narrow viewport but a mouse-primary device. */
export function setNarrowDesktopViewport() {
  setInnerWidth(MOBILE_WIDTH);
  stubMatchMedia(false);
}

export function resetViewport() {
  setInnerWidth(DESKTOP_WIDTH);
  window.matchMedia = originalMatchMedia;
}

// Importing this module restores the desktop viewport after every test, so tests never leak a
// mobile viewport into each other and don't need to reset it themselves.
afterEach(() => {
  resetViewport();
});

/**
 * Sets the viewport before each test in the enclosing `describe` (or file) and restores it afterwards.
 * Use `setMobileViewport` directly for tests that switch viewports mid-test.
 */
export function testWithViewport(viewport: 'mobile' | 'narrow-desktop') {
  beforeEach(() => {
    if (viewport === 'mobile') {
      setMobileViewport();
    } else {
      setNarrowDesktopViewport();
    }
  });
}
