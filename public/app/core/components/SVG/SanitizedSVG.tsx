import React from 'react';
import SVG, { Props } from 'react-inlinesvg';

import { textUtil } from '@grafana/data';

export const SanitizedSVG = (props: Props) => {
  return <SVG {...props} cacheRequests={true} preProcessor={getCleanSVG} />;
};

let cache = new Map<string, string>();

function getCleanSVG(code: string): string {
  let clean = cache.get(code);
  if (!clean) {
    clean = textUtil.sanitizeSVGContent(code);
    cache.set(code, clean);
  }
  return clean;
}
