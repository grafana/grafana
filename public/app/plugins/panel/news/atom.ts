import { textUtil } from '@grafana/data';

import { getProperty } from './feed';
import { Feed } from './types';

export function parseAtomFeed(txt: string): Feed {
  const domParser = new DOMParser();
  const doc = domParser.parseFromString(textUtil.sanitizeTrustedTypesRSS(txt), 'text/xml');

  const feed: Feed = {
    items: Array.from(doc.querySelectorAll('entry')).map((node) => ({
      title: getProperty(node, 'title'),
      link: node.querySelector('link')?.getAttribute('href') ?? '',
      content: getProperty(node, 'content'),
      pubDate: getProperty(node, 'published'),
      ogImage:
        node.querySelector("meta[property='og:image']")?.getAttribute('content') ??
        node.querySelector('meta')?.getAttribute('content'),
    })),
  };

  return feed;
}
