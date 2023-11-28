import React from 'react';
export const AngularRoot = React.forwardRef((props, ref) => {
    return (React.createElement("div", { id: "ngRoot", ref: ref, dangerouslySetInnerHTML: {
            __html: '<grafana-app ng-cloak></grafana-app>',
        } }));
});
AngularRoot.displayName = 'AngularRoot';
//# sourceMappingURL=AngularRoot.js.map