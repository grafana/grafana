import { type PanelItem } from '../../types/itemOverrides';
import { itemMatchers } from '../itemMatchers';

import { ItemMatcherID } from './ids';

const items: PanelItem[] = [
  { id: 'eu-west', label: 'EU West' },
  { id: 'us-east', label: 'US East' },
  { id: 'us-west', label: 'US West' },
  { id: 'no-label' },
];

function matched(matcherId: string, options?: unknown): string[] {
  const matcher = itemMatchers.get(matcherId).get(options);
  return items.filter(matcher).map((item) => item.id);
}

describe('byItemIds matcher', () => {
  it('matches only the listed ids', () => {
    expect(matched(ItemMatcherID.byItemIds, ['eu-west', 'us-east'])).toEqual(['eu-west', 'us-east']);
  });

  it('ignores ids that are not present', () => {
    expect(matched(ItemMatcherID.byItemIds, ['eu-west', 'does-not-exist'])).toEqual(['eu-west']);
  });

  it('matches nothing for an empty or missing selection', () => {
    expect(matched(ItemMatcherID.byItemIds, [])).toEqual([]);
    expect(matched(ItemMatcherID.byItemIds, undefined)).toEqual([]);
  });

  it('matches on id, not label', () => {
    expect(matched(ItemMatcherID.byItemIds, ['EU West'])).toEqual([]);
  });
});

describe('byItemRegexp matcher', () => {
  it('matches against the label when one is present', () => {
    expect(matched(ItemMatcherID.byItemRegexp, '/^US/')).toEqual(['us-east', 'us-west']);
  });

  it('falls back to the id when the item has no label', () => {
    expect(matched(ItemMatcherID.byItemRegexp, '/^no-/')).toEqual(['no-label']);
  });

  it('anchors a bare pattern, matching the byRegexp field matcher', () => {
    expect(matched(ItemMatcherID.byItemRegexp, 'US East')).toEqual(['us-east']);
    expect(matched(ItemMatcherID.byItemRegexp, 'US')).toEqual([]);
  });

  it('matches nothing for an unparseable pattern rather than throwing', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(matched(ItemMatcherID.byItemRegexp, '/unterminated')).toEqual([]);
    jest.restoreAllMocks();
  });

  it('matches nothing for an empty pattern', () => {
    expect(matched(ItemMatcherID.byItemRegexp, '')).toEqual([]);
  });
});

describe('allItems matcher', () => {
  it('matches every item', () => {
    expect(matched(ItemMatcherID.allItems)).toEqual(['eu-west', 'us-east', 'us-west', 'no-label']);
  });
});
