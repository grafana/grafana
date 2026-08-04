import { getNavSubTitle, getNavTitle } from './navBarItem-translations';

describe('navBarItem-translations', () => {
  describe('getNavTitle', () => {
    it('returns the title for the Alerting Watchers nav item', () => {
      expect(getNavTitle('standalone-plugin-page-assistant-watchers')).toBe('Watchers');
    });

    it('returns undefined for an unknown nav ID', () => {
      expect(getNavTitle('not-a-real-nav-id')).toBeUndefined();
    });

    it('returns undefined when no nav ID is given', () => {
      expect(getNavTitle(undefined)).toBeUndefined();
    });
  });

  describe('getNavSubTitle', () => {
    it('returns the subtitle for the Alerting Watchers nav item', () => {
      expect(getNavSubTitle('standalone-plugin-page-assistant-watchers')).toBe(
        'Let the Assistant watch your data and notify you when something needs attention'
      );
    });

    it('returns undefined for an unknown nav ID', () => {
      expect(getNavSubTitle('not-a-real-nav-id')).toBeUndefined();
    });

    it('returns undefined when no nav ID is given', () => {
      expect(getNavSubTitle(undefined)).toBeUndefined();
    });
  });
});
