import { type NavModelItem } from '@grafana/data';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { NavID, NavWeight } from './constants';
import { applyNavTweaks, moveNavItemToSection } from './navTweaks';
import { navIds as ids } from './test-utils';
import { findNavById } from './utils';

// Shaped like a finished tree of either origin: urls already prefixed, sections
// sorted, and the app in More apps carrying the weight an unplaced app gets
const tree = (): NavModelItem[] => [
  { id: 'home', text: 'Home', url: '/' },
  {
    id: 'plugin-page-grafana-ml-app',
    text: 'Machine Learning',
    url: '/a/grafana-ml-app',
    sortWeight: NavWeight.aiAndMl,
  },
  {
    id: NavID.apps,
    text: 'More apps',
    url: '/apps',
    sortWeight: NavWeight.apps,
    children: [{ id: 'plugin-page-some-app', text: 'Some app', url: '/a/some-app', sortWeight: NavWeight.plugin }],
  },
];

describe('applyNavTweaks', () => {
  afterEach(() => {
    setTestFlags({});
  });

  it('leaves the tree alone while the flag is off', () => {
    setTestFlags({ 'grafana.navigationInfoArchRefresh': false });

    expect(applyNavTweaks(tree())).toEqual(tree());
  });

  it('moves Machine Learning in among the apps once the flag is on', () => {
    setTestFlags({ 'grafana.navigationInfoArchRefresh': true });

    const tweaked = applyNavTweaks(tree());

    expect(ids(tweaked)).not.toContain('plugin-page-grafana-ml-app');
    // Among the apps, not above them: the tweak resets the top-level weight the
    // app arrives with, so it ties with its new siblings and keeps their order
    expect(ids(findNavById(tweaked, NavID.apps)?.children ?? [])).toEqual([
      'plugin-page-some-app',
      'plugin-page-grafana-ml-app',
    ]);
  });
});

describe('a tweak that throws', () => {
  afterEach(() => {
    setTestFlags({});
    jest.restoreAllMocks();
  });

  // This runs while the redux store is being created, so one bad tweak must cost
  // itself and nothing else
  it('leaves the tree as the other tweaks left it', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    setTestFlags({ 'grafana.navigationInfoArchRefresh': true });

    const tweaked = applyNavTweaks(tree(), [
      {
        description: 'throws',
        apply: () => {
          throw new Error('boom');
        },
      },
      {
        description: 'still runs',
        apply: (current) => moveNavItemToSection(current, 'plugin-page-grafana-ml-app', NavID.apps),
      },
    ]);

    expect(ids(findNavById(tweaked, NavID.apps)?.children ?? [])).toContain('plugin-page-grafana-ml-app');
    expect(warn).toHaveBeenCalledWith('[navtree] nav tweak failed', 'throws', expect.any(Error));
  });
});

describe('moveNavItemToSection', () => {
  it('re-sorts the destination around the weight it is given', () => {
    const moved = moveNavItemToSection(tree(), 'plugin-page-grafana-ml-app', NavID.apps, NavWeight.plugin - 1);

    const apps = findNavById(moved, NavID.apps);
    expect(ids(apps?.children ?? [])).toEqual(['plugin-page-grafana-ml-app', 'plugin-page-some-app']);
    expect(findNavById(apps?.children ?? [], 'plugin-page-grafana-ml-app')).toMatchObject({
      text: 'Machine Learning',
      url: '/a/grafana-ml-app',
      sortWeight: NavWeight.plugin - 1,
    });
  });

  it('leaves the tree alone when either end is missing', () => {
    expect(moveNavItemToSection(tree(), 'plugin-page-absent-app', NavID.apps)).toEqual(tree());
    expect(moveNavItemToSection(tree(), 'plugin-page-grafana-ml-app', 'nonexistent')).toEqual(tree());
  });
});
