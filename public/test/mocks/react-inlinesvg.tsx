import React from 'react';

export default function ReactInlineSVG({ src, innerRef, ...rest }) {
  return <svg id={src} {...rest} />;
}

export const cacheStore = {};
