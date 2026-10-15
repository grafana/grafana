import { useCallback } from 'react';
import SVG, { type Props } from 'react-inlinesvg';

import { textUtil } from '@grafana/data';

import { svgStyleCleanup } from './utils';

type SanitizedSVGProps = Props & { cleanStyle?: boolean };

export const SanitizedSVG = (props: SanitizedSVGProps) => {
  const { cleanStyle, ...inlineSvgProps } = props;
  const trusted = isTrustedSVGSource(inlineSvgProps.src);
  const preProcessor = useCallback(
    (code: string) => getCleanSVG(code, trusted, Boolean(cleanStyle)),
    [trusted, cleanStyle]
  );
  return <SVG {...inlineSvgProps} cacheRequests={true} preProcessor={preProcessor} />;
};

// Only SVGs that ship with Grafana (public/build and public/img) may keep <style>.
// Everything else under the public path, such as public/plugins, can come from third parties.
// react-inlinesvg uses `src` as markup when it contains `<svg` or is a data: URL, so those are never trusted.
const TRUSTED_PUBLIC_DIRS = ['build/', 'img/'];

export function isTrustedSVGSource(src: unknown): boolean {
  if (typeof src !== 'string' || src.includes('<') || src.trim().toLowerCase().startsWith('data:')) {
    return false;
  }

  try {
    const publicPath = new URL(window.__grafana_public_path__ || 'public/', document.baseURI);
    const url = new URL(src, document.baseURI);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.origin === publicPath.origin &&
      TRUSTED_PUBLIC_DIRS.some((dir) => url.pathname.startsWith(publicPath.pathname + dir))
    );
  } catch {
    return false;
  }
}

let cache = new Map<string, string>();

function getCleanSVG(code: string, trusted: boolean, cleanStyle: boolean): string {
  const key = `${trusted ? 't' : 'u'}${cleanStyle ? 's' : ''}:${code}`;
  let clean = cache.get(key);
  if (!clean) {
    clean = trusted ? textUtil.sanitizeSVGContent(code) : textUtil.sanitizeUntrustedSVGContent(code);

    if (cleanStyle && clean.indexOf('<style type="text/css">') > -1) {
      clean = svgStyleCleanup(clean);
    }

    cache.set(key, clean);
  }

  return clean;
}
