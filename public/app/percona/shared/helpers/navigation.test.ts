import { NavModelItem } from '@grafana/data';

import { sortWithSubsections } from './navigation';

describe('NavigationUtils', () => {
  describe('sortWithSubsections', () => {
    it("doesn't modify if there aren't subheaders", () => {
      const items: NavModelItem[] = [
        {
          text: 'Item #1',
        },
        {
          text: 'Item #2',
        },
      ];
      expect(sortWithSubsections(items)).toStrictEqual(items);
    });

    it('sorts with two subsections without headers', () => {
      const items: NavModelItem[] = [
        {
          text: 'Item #1',
        },
        {
          text: '',
        },
        {
          text: 'Item #2',
        },
      ];
      expect(sortWithSubsections(items)).toStrictEqual(items);
    });

    it('sorts with two subsections with headers', () => {
      const items: NavModelItem[] = [
        {
          text: 'Item #1',
        },
        {
          text: 'Header #1',
        },
        {
          text: '',
        },
        {
          text: 'Header #2',
        },
        {
          text: 'Item #2',
        },
      ];
      const expected: NavModelItem[] = [
        {
          text: 'Header #1',
        },
        {
          text: 'Item #1',
        },
        {
          text: '',
        },
        {
          text: 'Header #2',
        },
        {
          text: 'Item #2',
        },
      ];
      expect(sortWithSubsections(items)).toStrictEqual(expected);
    });

    it('sorts with three subsections with headers', () => {
      const items: NavModelItem[] = [
        {
          text: 'Item #1',
        },
        {
          text: 'Header #1',
        },
        {
          text: '',
        },
        {
          text: 'Header #2',
        },
        {
          text: '',
        },
        {
          text: 'Item #3',
        },
        {
          text: 'Header #3',
        },
      ];
      const expected: NavModelItem[] = [
        {
          text: 'Header #1',
        },
        {
          text: 'Item #1',
        },
        {
          text: '',
        },
        {
          text: 'Header #2',
        },
        {
          text: '',
        },
        {
          text: 'Header #3',
        },
        {
          text: 'Item #3',
        },
      ];
      expect(sortWithSubsections(items)).toStrictEqual(expected);
    });
  });
});
