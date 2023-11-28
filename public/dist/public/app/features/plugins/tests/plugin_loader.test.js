import { __awaiter } from "tslib";
// Use the real plugin_loader (stubbed by default)
jest.unmock('app/features/plugins/plugin_loader');
jest.mock('app/core/core', () => {
    return {
        coreModule: {
            directive: jest.fn(),
        },
    };
});
import { PluginType, AppPlugin } from '@grafana/data';
import { SystemJS } from '@grafana/runtime';
// Loaded after the `unmock` above
import { importAppPlugin } from '../plugin_loader';
class MyCustomApp extends AppPlugin {
    constructor() {
        super(...arguments);
        this.initWasCalled = false;
        this.calledTwice = false;
    }
    init(meta) {
        this.initWasCalled = true;
        this.calledTwice = this.meta === meta;
    }
}
describe('Load App', () => {
    const app = new MyCustomApp();
    const modulePath = 'http://localhost:3000/public/plugins/my-app-plugin/module.js';
    // Hook resolver for tests
    const originalResolve = SystemJS.constructor.prototype.resolve;
    SystemJS.constructor.prototype.resolve = (x) => x;
    beforeAll(() => {
        SystemJS.set(modulePath, { plugin: app });
    });
    afterAll(() => {
        SystemJS.delete(modulePath);
        SystemJS.constructor.prototype.resolve = originalResolve;
    });
    it('should call init and set meta', () => __awaiter(void 0, void 0, void 0, function* () {
        const meta = {
            id: 'test-app',
            module: modulePath,
            baseUrl: 'xxx',
            info: {},
            type: PluginType.app,
            name: 'test',
        };
        // Check that we mocked the import OK
        const m = yield SystemJS.import(modulePath);
        expect(m.plugin).toBe(app);
        const loaded = yield importAppPlugin(meta);
        expect(loaded).toBe(app);
        expect(app.meta).toBe(meta);
        expect(app.initWasCalled).toBeTruthy();
        expect(app.calledTwice).toBeFalsy();
        const again = yield importAppPlugin(meta);
        expect(again).toBe(app);
        expect(app.calledTwice).toBeTruthy();
    }));
});
//# sourceMappingURL=plugin_loader.test.js.map