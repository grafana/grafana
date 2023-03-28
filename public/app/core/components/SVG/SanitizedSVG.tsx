import * as DOMPurify from 'dompurify';
import React from 'react';
import SVG, { Props } from 'react-inlinesvg';

export const SanitizedSVG = (props: Props) => {
  return <SVG {...props} cacheRequests={true} preProcessor={getCleanSVG} />;
};

let cache = new Map<string, string>();

function getCleanSVG(code: string): string {
  let clean = cache.get(code);
  if (!clean) {
    clean = DOMPurify.sanitize(code, { USE_PROFILES: { svg: true, svgFilters: true } });
    cache.set(code, clean);
  }
  return clean;
}
