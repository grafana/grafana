import { plugin } from './module';

describe('Table panel plugin', () => {
  it('should have cellHeight and enablePagination as quick edit options', () => {
    const quickEditPaths = plugin.getQuickEditPaths();

    expect(quickEditPaths).toEqual(['cellHeight', 'enablePagination']);
  });
});
