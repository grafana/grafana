import { renderHook } from '@testing-library/react';
import { type RefObject } from 'react';

import {
  EditActionsLayoutProvider,
  measureSidebarShiftPadding,
  useEditActionsLayout,
} from './EditActionsLayoutContext';

function stubClientRect(element: HTMLElement, left: number, right: number) {
  jest.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    x: left,
    y: 0,
    top: 0,
    bottom: 0,
    left,
    right,
    width: right - left,
    height: 0,
    toJSON() {
      return {};
    },
  });
}

describe('measureSidebarShiftPadding()', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('when the canvas is missing, padding is 0', () => {
    const sidebar = document.createElement('div');

    expect(measureSidebarShiftPadding(undefined, sidebar)).toBe(0);
  });

  test('when the sidebar is missing, padding is 0', () => {
    const canvas = document.createElement('div');

    expect(measureSidebarShiftPadding(canvas, undefined)).toBe(0);
  });

  test('when the canvas right edge is 1000 and the sidebar left edge is 680, right padding is 320', () => {
    const canvas = document.createElement('div');
    const sidebar = document.createElement('div');
    stubClientRect(canvas, 0, 1000);
    stubClientRect(sidebar, 680, 1000);

    expect(measureSidebarShiftPadding(canvas, sidebar)).toEqual({ right: 320 });
  });

  test('when the sidebar left edge is past the canvas right edge, right padding is 0', () => {
    const canvas = document.createElement('div');
    const sidebar = document.createElement('div');
    stubClientRect(canvas, 0, 1000);
    stubClientRect(sidebar, 1100, 1420);

    expect(measureSidebarShiftPadding(canvas, sidebar)).toEqual({ right: 0 });
  });
});

function renderUseEditActionsLayout({
  canvas = null,
  isDocked = false,
  isHidden = false,
}: {
  canvas?: HTMLDivElement | null;
  isDocked?: boolean;
  isHidden?: boolean;
} = {}) {
  const canvasRef: RefObject<HTMLDivElement | null> = { current: canvas };

  return renderHook(() => useEditActionsLayout(), {
    wrapper: ({ children }) => (
      <EditActionsLayoutProvider canvasRef={canvasRef} isDocked={isDocked} isHidden={isHidden}>
        {children}
      </EditActionsLayoutProvider>
    ),
  });
}

describe('useEditActionsLayout()', () => {
  afterEach(() => {
    document.getElementById('sidebar-container')?.remove();
    jest.restoreAllMocks();
  });

  describe('when there is no provider', () => {
    test('portal root is undefined', () => {
      const { result } = renderHook(() => useEditActionsLayout());

      expect(result.current.getPortalRoot()).toBeUndefined();
    });

    test('sidebar shift padding is 0', () => {
      const { result } = renderHook(() => useEditActionsLayout());

      expect(result.current.getSidebarShiftPadding()).toBe(0);
    });
  });

  test('when the provider has a canvas ref, getPortalRoot returns that element', () => {
    const canvas = document.createElement('div');
    const { result } = renderUseEditActionsLayout({ canvas });

    expect(result.current.getPortalRoot()).toBe(canvas);
  });

  test('when the provider is docked, sidebar shift padding is 0', () => {
    const canvas = document.createElement('div');
    const sidebar = document.createElement('div');
    sidebar.id = 'sidebar-container';
    document.body.appendChild(sidebar);
    stubClientRect(canvas, 0, 1000);
    stubClientRect(sidebar, 680, 1000);

    const { result } = renderUseEditActionsLayout({ canvas, isDocked: true });

    expect(result.current.getSidebarShiftPadding()).toBe(0);
  });

  test('when the provider is hidden, sidebar shift padding is 0', () => {
    const canvas = document.createElement('div');
    const sidebar = document.createElement('div');
    sidebar.id = 'sidebar-container';
    document.body.appendChild(sidebar);
    stubClientRect(canvas, 0, 1000);
    stubClientRect(sidebar, 680, 1000);

    const { result } = renderUseEditActionsLayout({ canvas, isHidden: true });

    expect(result.current.getSidebarShiftPadding()).toBe(0);
  });

  test('when the provider is undocked and the sidebar is missing, sidebar shift padding is 0', () => {
    const canvas = document.createElement('div');
    const { result } = renderUseEditActionsLayout({ canvas, isDocked: false, isHidden: false });

    expect(result.current.getSidebarShiftPadding()).toBe(0);
  });

  test('when the provider is undocked and the canvas right is 1000 and the sidebar left is 680, right padding is 320', () => {
    const canvas = document.createElement('div');
    const sidebar = document.createElement('div');
    sidebar.id = 'sidebar-container';
    document.body.appendChild(sidebar);
    stubClientRect(canvas, 0, 1000);
    stubClientRect(sidebar, 680, 1000);

    const { result } = renderUseEditActionsLayout({ canvas, isDocked: false, isHidden: false });

    expect(result.current.getSidebarShiftPadding()).toEqual({ right: 320 });
  });
});
