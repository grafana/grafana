import { plugin } from './module';

describe('Timeseries panel plugin', () => {
  it('should have legend.showLegend and legend.calcs as quick edit options', () => {
    const quickEditPaths = plugin.getQuickEditPaths();

    expect(quickEditPaths).toEqual(['legend.showLegend', 'legend.calcs']);
  });
});
