import SVG, { type Props } from 'react-inlinesvg';

import { textUtil } from '@grafana/data/text';

import { svgStyleCleanup } from './utils';

type SanitizedSVGProps = Props & { cleanStyle?: boolean };

export const SanitizedSVG = (props: SanitizedSVGProps) => {
  const { cleanStyle, ...inlineSvgProps } = props;
  // @ts-expect-error react-inlinesvg@4.3.0 return type includes bigint, which isn't in @types/react@18's ReactNode. Remove when we update @types/react.
  return <SVG {...inlineSvgProps} cacheRequests={true} preProcessor={cleanStyle ? getCleanSVGAndStyle : getCleanSVG} />;
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

function getCleanSVGAndStyle(code: string): string {
  let clean = cache.get(code);
  if (!clean) {
    clean = textUtil.sanitizeSVGContent(code);

    if (clean.indexOf('<style type="text/css">') > -1) {
      clean = svgStyleCleanup(clean);
    }

    cache.set(code, clean);
  }

  return clean;
}
