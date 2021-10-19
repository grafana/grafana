import React from 'react';

export default function ReactInlineSVG({ src, title, width, height, style }) {
  return <svg className="mock-svg" id={src} title={title} width={width} height={height} style={style} />;
}

export function cacheStore() {
  return [];
}
