import { sharedDependenciesMap } from './sharedDependencies';

describe('sharedDependenciesMap', () => {
  it('loads jQuery only when a plugin requests it', () => {
    expect(sharedDependenciesMap.jquery).toEqual(expect.any(Function));
  });

  it('loads Flot only when a plugin requests a Flot dependency', () => {
    const dependencies = sharedDependenciesMap as Record<string, unknown>;
    const flotDependencies = [
      'jquery.flot.crosshair',
      'jquery.flot.events',
      'jquery.flot.fillbelow',
      'jquery.flot.gauge',
      'jquery.flot.pie',
      'jquery.flot.selection',
      'jquery.flot.stack',
      'jquery.flot.stackpercent',
      'jquery.flot.time',
      'jquery.flot',
    ];

    for (const dependency of flotDependencies) {
      expect(dependencies[dependency]).toEqual(expect.any(Function));
    }
  });
});
