import { __assign, __awaiter, __generator } from "tslib";
import { ThemeChangedEvent } from '@grafana/runtime';
import appEvents from '../app_events';
import { config } from '../config';
import { PreferencesService } from './PreferencesService';
import { contextSrv } from '../core';
import { createTheme } from '@grafana/data';
export function toggleTheme(runtimeOnly) {
    return __awaiter(this, void 0, void 0, function () {
        var currentTheme, newTheme, newCssLink, bodyLinks, _loop_1, i, service, currentPref;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    currentTheme = config.theme;
                    newTheme = createTheme({
                        colors: {
                            mode: currentTheme.isDark ? 'light' : 'dark',
                        },
                    });
                    appEvents.publish(new ThemeChangedEvent(newTheme));
                    if (runtimeOnly) {
                        return [2 /*return*/];
                    }
                    newCssLink = document.createElement('link');
                    newCssLink.rel = 'stylesheet';
                    newCssLink.href = config.bootData.themePaths[newTheme.colors.mode];
                    document.body.appendChild(newCssLink);
                    bodyLinks = document.getElementsByTagName('link');
                    _loop_1 = function (i) {
                        var link = bodyLinks[i];
                        if (link.href && link.href.indexOf("build/grafana." + currentTheme.type) > 0) {
                            // Remove existing link after a 500ms to allow new css to load to avoid flickering
                            // If we add new css at the same time we remove current one the page will be rendered without css
                            // As the new css file is loading
                            setTimeout(function () { return link.remove(); }, 500);
                        }
                    };
                    for (i = 0; i < bodyLinks.length; i++) {
                        _loop_1(i);
                    }
                    if (!contextSrv.isSignedIn) {
                        return [2 /*return*/];
                    }
                    service = new PreferencesService('user');
                    return [4 /*yield*/, service.load()];
                case 1:
                    currentPref = _a.sent();
                    return [4 /*yield*/, service.update(__assign(__assign({}, currentPref), { theme: newTheme.colors.mode }))];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
//# sourceMappingURL=toggleTheme.js.map