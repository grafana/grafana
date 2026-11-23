/**
 * Viewport helpers for tests of the mobile edit deprecation (`grafana.mobileEditDeprecation`).
 *
 * Side effect: importing this module registers a file-wide `afterEach` that restores the test
 * environment's default viewport, so a viewport set in one test never leaks into the next and tests
 * don't reset it themselves.
 */
import { TOUCH_PRIMARY_QUERY } from './mobileEditDeprecation';

const DESKTOP_WIDTH = 1024;
const MOBILE_WIDTH = 375;

const originalMatchMedia = window.matchMedia;

function setInnerWidth(value: number) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value });
}

/** Answers the touch query and `(min-width: Npx)` queries for the given device; every other query is false. */
function stubMatchMedia(width: number, touchPrimary: boolean) {
  window.matchMedia = (query: string) => {
    const minWidth = /^\(min-width: (\d+)px\)$/.exec(query)?.[1];
    let matches = false;
    if (query === TOUCH_PRIMARY_QUERY) {
      matches = touchPrimary;
    } else if (minWidth) {
      matches = width >= Number(minWidth);
    }
    return { ...originalMatchMedia(query), matches };
  };
}

function setViewport(width: number, touchPrimary: boolean) {
  setInnerWidth(width);
  stubMatchMedia(width, touchPrimary);
}

/** A phone: narrow viewport with a touch-primary input device. */
export function setMobileViewport() {
  setViewport(MOBILE_WIDTH, true);
}

/** A desktop window dragged narrow, or zoomed in: narrow viewport but a mouse-primary device. */
export function setNarrowDesktopViewport() {
  setViewport(MOBILE_WIDTH, false);
}

/** A desktop: wide viewport with a mouse-primary device. */
export function setDesktopViewport() {
  setViewport(DESKTOP_WIDTH, false);
}

/**
 * Restores the test environment's defaults. Not the same as `setDesktopViewport`: the global
 * `matchMedia` mock answers every query with false, so React hooks still see a narrow viewport.
 */
function resetViewport() {
  setInnerWidth(DESKTOP_WIDTH);
  window.matchMedia = originalMatchMedia;
}

afterEach(() => {
  resetViewport();
});

/**
 * Sets the viewport before each test in the enclosing `describe` (or file).
 * Use the `set*Viewport` functions directly for tests that switch viewports mid-test.
 */
export function testWithViewport(viewport: 'mobile' | 'desktop') {
  beforeEach(() => {
    if (viewport === 'mobile') {
      setMobileViewport();
    } else {
      setDesktopViewport();
    }
  });
}
