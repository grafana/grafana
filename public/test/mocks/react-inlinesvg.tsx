import React from 'react';

export default function ReactInlineSVG({ src, innerRef, cacheRequests, preProcessor, ...rest }) {
  return <svg id={src} ref={innerRef} {...rest} />;
}

export const cacheStore = {};
