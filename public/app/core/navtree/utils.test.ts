import { type NavModelItem } from '@grafana/data';

import { findNavByUrl } from './utils';

describe('findNavByUrl', () => {
  const tree: NavModelItem[] = [
    { text: 'Home', id: 'home', url: '/' },
    {
      text: 'Section',
      id: 'section',
      children: [
        { text: 'Item', id: 'item', url: '/item' },
        { text: 'Report', id: 'report', url: '/reports/usage?tab=daily' },
      ],
    },
  ];

  it('returns the first item, at any depth, whose url satisfies the match', () => {
    expect(findNavByUrl(tree, (url) => url === '/')?.id).toBe('home');
    expect(findNavByUrl(tree, (url) => url === '/item')?.id).toBe('item');
    expect(findNavByUrl(tree, (url) => url.split('?')[0] === '/reports/usage')?.id).toBe('report');
  });

  it('skips items without a url and returns undefined when nothing matches', () => {
    expect(findNavByUrl(tree, (url) => url === '/no-item')).toBeUndefined();
  });
});
