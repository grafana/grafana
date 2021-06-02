import { ResourcesUnits, ResourcesWithUnits } from '../DBCluster.types';
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
    const getValueWithUnits = (value: number) => ({ value, units: ResourcesUnits.GB } as ResourcesWithUnits);

    expect(formatResources(getValueWithUnits(0.04))).toEqual(getValueWithUnits(0.04));
    expect(formatResources(getValueWithUnits(0.004))).toEqual(getValueWithUnits(0));
    expect(formatResources(getValueWithUnits(0.07340032))).toEqual(getValueWithUnits(0.07));
    expect(formatResources(getValueWithUnits(0.076))).toEqual(getValueWithUnits(0.08));
    expect(formatResources(getValueWithUnits(4.129873))).toEqual(getValueWithUnits(4.13));
    expect(formatResources(getValueWithUnits(0.65))).toEqual(getValueWithUnits(0.65));
    expect(formatResources(getValueWithUnits(6))).toEqual(getValueWithUnits(6));
  });
});
