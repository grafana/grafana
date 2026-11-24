import { type NavModelItem } from '@grafana/data';

import { Branding } from '../Branding/Branding';

import { getPageName, getPageTitleParts } from './usePageTitle';

const section: NavModelItem = { text: 'Alerting', url: '/alerting' };
const rules: NavModelItem = { text: 'Alert rules', url: '/alerting/list', parentItem: section };
const home: NavModelItem = { text: 'Home', url: '/' };

describe('getPageTitleParts', () => {
  it("lists a section page's crumbs, most specific first, then the app title", () => {
    expect(getPageTitleParts({ node: rules, main: section }, undefined, home)).toEqual([
      'Alert rules',
      'Alerting',
      Branding.AppTitle,
    ]);
  });

  it('starts with the page nav when the page has one', () => {
    expect(getPageTitleParts({ node: rules, main: section }, { text: 'Edit rule' }, home)).toEqual([
      'Edit rule',
      'Alert rules',
      'Alerting',
      Branding.AppTitle,
    ]);
  });

  it('is only the app title without navigation', () => {
    expect(getPageTitleParts()).toEqual([Branding.AppTitle]);
  });
});

describe('getPageName', () => {
  const explore: NavModelItem = { text: 'Explore', url: '/explore' };

  it('is the section on Explore, whose pageNav names the data source without a link', () => {
    expect(getPageName({ node: explore, main: explore }, { text: 'grafanacloud-prom' }, home)).toBe('Explore');
  });

  it("is a dashboard's title, since its pageNav links to the dashboard", () => {
    const dashboards: NavModelItem = { text: 'Dashboards', url: '/dashboards' };
    const dashboard: NavModelItem = { text: 'CPU usage', url: '/d/cpu/cpu-usage', parentItem: dashboards };
    expect(getPageName({ node: dashboards, main: dashboards }, dashboard, home)).toBe('CPU usage');
  });

  it("is a section page's name", () => {
    expect(getPageName({ node: rules, main: section }, undefined, home)).toBe('Alert rules');
  });

  it('is undefined without navigation', () => {
    expect(getPageName()).toBeUndefined();
  });
});
