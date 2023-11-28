import { __awaiter } from "tslib";
let injector;
/**
 * Future poc to lazy load angular app, not yet used
 */
export function getAngularInjector() {
    return __awaiter(this, void 0, void 0, function* () {
        if (injector) {
            return injector;
        }
        const { AngularApp } = yield import(/* webpackChunkName: "AngularApp" */ './index');
        if (injector) {
            return injector;
        }
        const app = new AngularApp();
        app.init();
        injector = app.bootstrap();
        return injector;
    });
}
//# sourceMappingURL=lazyBootAngular.js.map