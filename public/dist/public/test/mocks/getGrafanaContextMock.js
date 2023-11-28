import { AppChromeService } from 'app/core/components/AppChrome/AppChromeService';
import { backendSrv } from 'app/core/services/backend_srv';
/** Not sure what this should evolve into, just a starting point */
export function getGrafanaContextMock(overrides = {}) {
    return Object.assign({ chrome: new AppChromeService(), backend: backendSrv, 
        // eslint-disable-next-line
        location: {}, 
        // eslint-disable-next-line
        config: { featureToggles: {} }, 
        // eslint-disable-next-line
        keybindings: {
            clearAndInitGlobalBindings: jest.fn(),
            setupDashboardBindings: jest.fn(),
            setupTimeRangeBindings: jest.fn(),
        } }, overrides);
}
//# sourceMappingURL=getGrafanaContextMock.js.map