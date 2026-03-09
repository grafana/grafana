import { plugin } from './module';

describe('Stat panel plugin', () => {
  it('should have textMode, colorMode, and graphMode as quick edit options', () => {
    const quickEditPaths = plugin.getQuickEditPaths();

    expect(quickEditPaths).toEqual(['textMode', 'colorMode', 'graphMode']);
  });
});
