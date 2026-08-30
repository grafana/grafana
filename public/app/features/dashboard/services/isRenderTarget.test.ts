import { contextSrv } from 'app/core/services/context_srv';
import { DashboardRoutes } from 'app/types/dashboard';

import { isRenderTarget } from './isRenderTarget';

describe('isRenderTarget', () => {
  const originalAuthenticatedBy = contextSrv.user?.authenticatedBy;

  afterEach(() => {
    delete (window as { __grafanaImageRendererMessageChannel?: unknown }).__grafanaImageRendererMessageChannel;
    if (contextSrv.user) {
      contextSrv.user.authenticatedBy = originalAuthenticatedBy ?? '';
    }
  });

  describe('by route', () => {
    it('returns true for Report route', () => {
      expect(isRenderTarget(DashboardRoutes.Report)).toBe(true);
    });

    it('returns true for Embedded route', () => {
      expect(isRenderTarget(DashboardRoutes.Embedded)).toBe(true);
    });

    it('returns false for Normal route without other signals', () => {
      expect(isRenderTarget(DashboardRoutes.Normal)).toBe(false);
    });

    it('returns false for Home route without other signals', () => {
      expect(isRenderTarget(DashboardRoutes.Home)).toBe(false);
    });
  });

  describe('by image renderer binding', () => {
    it('returns true when the chromedp binding is present', () => {
      (window as { __grafanaImageRendererMessageChannel?: unknown }).__grafanaImageRendererMessageChannel = jest.fn();
      expect(isRenderTarget()).toBe(true);
    });

    it('returns true when the binding is present and route is Normal', () => {
      (window as { __grafanaImageRendererMessageChannel?: unknown }).__grafanaImageRendererMessageChannel = jest.fn();
      expect(isRenderTarget(DashboardRoutes.Normal)).toBe(true);
    });

    it('returns false when the binding is not a function', () => {
      (window as { __grafanaImageRendererMessageChannel?: unknown }).__grafanaImageRendererMessageChannel = 'not-a-fn';
      expect(isRenderTarget()).toBe(false);
    });
  });

  describe('by authenticatedBy fallback', () => {
    it('returns true when authenticatedBy is "render"', () => {
      if (contextSrv.user) {
        contextSrv.user.authenticatedBy = 'render';
      }
      expect(isRenderTarget()).toBe(true);
    });

    it('returns false when authenticatedBy is another value', () => {
      if (contextSrv.user) {
        contextSrv.user.authenticatedBy = 'password';
      }
      expect(isRenderTarget()).toBe(false);
    });

    it('returns false when authenticatedBy is empty', () => {
      if (contextSrv.user) {
        contextSrv.user.authenticatedBy = '';
      }
      expect(isRenderTarget()).toBe(false);
    });
  });

  describe('combined signals', () => {
    it('returns true when route is Report even if no other signals', () => {
      if (contextSrv.user) {
        contextSrv.user.authenticatedBy = '';
      }
      expect(isRenderTarget(DashboardRoutes.Report)).toBe(true);
    });

    it('returns true when route is Normal but binding is present', () => {
      (window as { __grafanaImageRendererMessageChannel?: unknown }).__grafanaImageRendererMessageChannel = jest.fn();
      if (contextSrv.user) {
        contextSrv.user.authenticatedBy = '';
      }
      expect(isRenderTarget(DashboardRoutes.Normal)).toBe(true);
    });

    it('returns false with no route, no binding, and no matching auth', () => {
      if (contextSrv.user) {
        contextSrv.user.authenticatedBy = 'password';
      }
      expect(isRenderTarget()).toBe(false);
    });
  });
});
