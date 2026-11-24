import { type NavModelItem } from '@grafana/data';

import { Branding } from '../Branding/Branding';

import { getPageTitleParts } from './usePageTitle';

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
