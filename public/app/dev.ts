import * as React from 'react';

import { potentiallySetupMockApi } from './dev-utils';

export async function initDevFeatures() {
  // if why-render is in url enable why did you render react extension
  if (window.location.search.indexOf('why-render') !== -1) {
    const { default: whyDidYouRender } = await import('@welldone-software/why-did-you-render');
    whyDidYouRender(React, {
      trackAllPureComponents: true,
    });
  }

  await potentiallySetupMockApi();
}
