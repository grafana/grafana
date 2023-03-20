import { parseAtomFeed } from './atom';
import { parseRSSFeed } from './rss';
//import {trustedTypes }from 'trusted-types';

export async function fetchFeedText(url: string) {
  const rsp = await fetch(url);
  const txt = await rsp.text();
  return txt;
}

export function isAtomFeed(txt: string) {
  const domParser = new DOMParser();

  //@ts-ignore
  if (trustedTypes.createPolicy) {
    //@ts-ignore
    const escapeHTMLPolicy = trustedTypes.createPolicy('atom', { createHTML: (s: string) => s });
    const escaped = escapeHTMLPolicy.createHTML(txt);
    const doc = domParser.parseFromString(escaped, 'text/xml');
    return doc.querySelector('feed') !== null;
  } else {
    const doc = domParser.parseFromString(txt, 'text/xml');
    return doc.querySelector('feed') !== null;
  }
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
