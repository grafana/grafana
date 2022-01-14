import { formatResources, getResourcesWidth } from './ResourcesBar.utils';

describe('ResourcesBar.utils::', () => {
  it('returns correct width', () => {
    expect(getResourcesWidth(1.5, 6)).toEqual(25);
    expect(getResourcesWidth(1.6, 6)).toEqual(26.7);
    expect(getResourcesWidth(5.6, 64)).toEqual(8.8);
    expect(getResourcesWidth(63.8, 64)).toEqual(99.7);
    expect(getResourcesWidth(10, 80)).toEqual(12.5);
    expect(getResourcesWidth(20, 80)).toEqual(25);
  });

  it('formats resources to 2 decimal places if needed', () => {
    expect(formatResources(0.04)).toEqual(0.04);
    expect(formatResources(0.004)).toEqual(0);
    expect(formatResources(0.07340032)).toEqual(0.07);
    expect(formatResources(0.076)).toEqual(0.08);
    expect(formatResources(4.129873)).toEqual(4.13);
    expect(formatResources(0.65)).toEqual(0.65);
    expect(formatResources(6)).toEqual(6);
  });
});
