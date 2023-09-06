import React from 'react';
import SVG, { Props } from 'react-inlinesvg';
import { v4 as uuidv4 } from 'uuid';

import { textUtil } from '@grafana/data';

type SanitizedSVGProps = Props & { cleanStyle?: boolean };
let shouldCleanSvgStyle = false;

export const SanitizedSVG = (props: SanitizedSVGProps) => {
  const { cleanStyle, ...inlineSvgProps } = props;
  shouldCleanSvgStyle = cleanStyle ?? false;

  return <SVG {...inlineSvgProps} cacheRequests={true} preProcessor={getCleanSVG} />;
};

let cache = new Map<string, string>();

function getCleanSVG(code: string): string {
  let clean = cache.get(code);
  if (!clean) {
    clean = textUtil.sanitizeSVGContent(code);

    if (shouldCleanSvgStyle && clean.indexOf('<style type="text/css">') > -1) {
      clean = svgStyleCleanup(clean);
    }

    cache.set(code, clean);
  }

  return clean;
}

function svgStyleCleanup(elementCode: string) {
  let svgId = elementCode.match(new RegExp('<svg.*id\\s*=\\s*([\'"])(.*?)\\1'))?.[2];
  if (!svgId) {
    svgId = `x${uuidv4()}`;
    const pos = elementCode.indexOf('<svg') + 5;
    elementCode = elementCode.substring(0, pos) + `id="${svgId}" ` + elementCode.substring(pos);
  }

  const matchStyle = elementCode.match(new RegExp('<style type="text/css">([\\s\\S]*?)<\\/style>'));
  if (matchStyle) {
    let svgStyle = matchStyle[0];
    let replacedId = svgStyle.replace(/(#(.*?))?\./g, `#${svgId} .`);
    elementCode = elementCode.replace(svgStyle, replacedId);
  }

  return elementCode;
}
