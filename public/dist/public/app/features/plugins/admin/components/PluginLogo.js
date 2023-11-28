import React from 'react';
export function PluginLogo({ alt, className, src, height }) {
    // @ts-ignore - react doesn't know about loading attr.
    return React.createElement("img", { src: src, className: className, alt: alt, loading: "lazy", height: height });
}
//# sourceMappingURL=PluginLogo.js.map