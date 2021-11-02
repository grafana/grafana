import React from 'react';
export function PluginLogo(_a) {
    var alt = _a.alt, className = _a.className, src = _a.src, height = _a.height;
    // @ts-ignore - react doesn't know about loading attr.
    return React.createElement("img", { src: src, className: className, alt: alt, loading: "lazy", height: height });
}
//# sourceMappingURL=PluginLogo.js.map