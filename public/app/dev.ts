import React from 'react';

export function initDevFeatures() {
  // if why-render is in url enable why did you render react extension
  if (window.location.search.indexOf('why-render') !== -1) {
    const whyDidYouRender = require('@welldone-software/why-did-you-render');
    whyDidYouRender(React, {
      trackAllPureComponents: true,
    });
  }
}
