import { getNavSubTitle, getNavTitle } from './navBarItem-translations';

describe('navBarItem-translations', () => {
  describe('getNavTitle', () => {
    it.each([
      ['alert-rules', 'Alert rules'],
      ['notification-config', 'Notification configuration'],
      ['alerts-history', 'History'],
      ['extensions', 'Extensions'],
      ['provisioning', 'Provisioning'],
      ['observability', 'Observability'],
    ])('returns the %s title', (navId, title) => {
      expect(getNavTitle(navId)).toBe(title);
    });

    it('returns undefined for an unknown nav ID', () => {
      expect(getNavTitle('not-a-real-nav-id')).toBeUndefined();
    });

    it('returns undefined when no nav ID is given', () => {
      expect(getNavTitle(undefined)).toBeUndefined();
    });
  });

  describe('getNavSubTitle', () => {
    it.each([
      ['alert-rules', 'Rules that determine whether an alert will fire'],
      ['notification-config', 'Manage contact points, notification policies, templates, and time intervals'],
      ['extensions', 'Extend the UI of plugins and Grafana'],
      ['provisioning', 'View and manage your provisioning connections'],
      [
        'observability',
        "Monitor infrastructure and applications in real time with Grafana Cloud's fully managed observability suite",
      ],
    ])('returns the %s subtitle', (navId, subTitle) => {
      expect(getNavSubTitle(navId)).toBe(subTitle);
    });

    it('returns undefined for an unknown nav ID', () => {
      expect(getNavSubTitle('not-a-real-nav-id')).toBeUndefined();
    });

    it('returns undefined when no nav ID is given', () => {
      expect(getNavSubTitle(undefined)).toBeUndefined();
    });
  });
});
