import React from 'react';

export const AngularRoot = React.forwardRef<HTMLDivElement, {}>((props, ref) => {
  return (
    <div
      id="ngRoot"
      ref={ref}
      dangerouslySetInnerHTML={{
        __html: '<grafana-app ng-cloak></grafana-app>',
      }}
    />
  );
});

AngularRoot.displayName = 'AngularRoot';
