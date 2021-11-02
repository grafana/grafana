import { createTheme } from '@grafana/data';
var themeMock;
/** @public */
export var getTheme = function (mode) {
    if (mode === void 0) { mode = 'dark'; }
    if (themeMock) {
        return themeMock(mode);
    }
    return createTheme({ colors: { mode: mode } }).v1;
};
/** @public */
export var mockTheme = function (mock) {
    themeMock = mock;
    return function () {
        themeMock = null;
    };
};
//# sourceMappingURL=getTheme.js.map