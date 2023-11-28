import { __awaiter } from "tslib";
import React from 'react';
export function initDevFeatures() {
    return __awaiter(this, void 0, void 0, function* () {
        // if why-render is in url enable why did you render react extension
        if (window.location.search.indexOf('why-render') !== -1) {
            const { default: whyDidYouRender } = yield import('@welldone-software/why-did-you-render');
            whyDidYouRender(React, {
                trackAllPureComponents: true,
            });
        }
    });
}
//# sourceMappingURL=dev.js.map