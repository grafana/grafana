import { textUtil } from '@grafana/data';

import { parseAtomFeed } from './atom';
import { parseRSSFeed } from './rss';

export async function fetchFeedText(url: string) {
  const rsp = await fetch(url);
  const txt = await rsp.text();
  return txt;
}

export function isAtomFeed(txt: string) {
  const domParser = new DOMParser();
  const doc = domParser.parseFromString(textUtil.sanitizeTrustedTypes(txt, 'rss'), 'text/xml');
  return doc.querySelector('feed') !== null;
}

export function getProperty(node: Element, property: string): string {
  const propNode = node.querySelector(property);
  return propNode?.textContent ?? '';
}

export async function loadFeed(url: string) {
  const res = await fetchFeedText(url);
  const parsedFeed = isAtomFeed(res) ? parseAtomFeed(res) : parseRSSFeed(res);
  return parsedFeed;
}
