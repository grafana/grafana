import { createTheme } from '@grafana/data';
let themeMock;
/** @public */
export const getTheme = (mode = 'dark') => {
    if (themeMock) {
        return themeMock(mode);
    }
    return createTheme({ colors: { mode } }).v1;
};
/** @public */
export const mockTheme = (mock) => {
    themeMock = mock;
    return () => {
        themeMock = null;
    };
};
//# sourceMappingURL=getTheme.js.map