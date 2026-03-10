import { getPanelPlugin } from '../../test';

describe('PanelPlugin', () => {
  describe('setQuickEditPaths', () => {
    it('should store quick edit paths', () => {
      const plugin = getPanelPlugin({ id: 'test-panel' });

      plugin.setQuickEditPaths(['path1', 'path2']);

      expect(plugin.getQuickEditPaths()).toEqual(['path1', 'path2']);
    });

    it('should return undefined when no paths are set', () => {
      const plugin = getPanelPlugin({ id: 'test-panel' });

      expect(plugin.getQuickEditPaths()).toBeUndefined();
    });

    it('should limit paths to maximum of 5', () => {
      const plugin = getPanelPlugin({ id: 'test-panel' });
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      plugin.setQuickEditPaths(['path1', 'path2', 'path3', 'path4', 'path5', 'path6', 'path7']);

      expect(plugin.getQuickEditPaths()).toEqual(['path1', 'path2', 'path3', 'path4', 'path5']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('setQuickEditPaths received 7 unique paths'));

      consoleSpy.mockRestore();
    });

    it('should allow exactly 5 paths without warning', () => {
      const plugin = getPanelPlugin({ id: 'test-panel' });
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      plugin.setQuickEditPaths(['path1', 'path2', 'path3', 'path4', 'path5']);

      expect(plugin.getQuickEditPaths()).toEqual(['path1', 'path2', 'path3', 'path4', 'path5']);
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should return this for method chaining', () => {
      const plugin = getPanelPlugin({ id: 'test-panel' });

      const result = plugin.setQuickEditPaths(['path1']);

      expect(result).toBe(plugin);
    });

    it('should create a copy of the paths array on set', () => {
      const plugin = getPanelPlugin({ id: 'test-panel' });
      const paths = ['path1', 'path2'];

      plugin.setQuickEditPaths(paths);
      paths.push('path3');

      expect(plugin.getQuickEditPaths()).toEqual(['path1', 'path2']);
    });

    it('should return a defensive copy on get to prevent mutation', () => {
      const plugin = getPanelPlugin({ id: 'test-panel' });
      plugin.setQuickEditPaths(['path1', 'path2']);

      const returnedPaths = plugin.getQuickEditPaths();
      returnedPaths?.push('path3');

      expect(plugin.getQuickEditPaths()).toEqual(['path1', 'path2']);
    });

    it('should deduplicate paths while preserving order', () => {
      const plugin = getPanelPlugin({ id: 'test-panel' });

      plugin.setQuickEditPaths(['path1', 'path2', 'path1', 'path3', 'path2']);

      expect(plugin.getQuickEditPaths()).toEqual(['path1', 'path2', 'path3']);
    });

    it('should deduplicate before applying max limit', () => {
      const plugin = getPanelPlugin({ id: 'test-panel' });
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // 7 paths but only 4 unique
      plugin.setQuickEditPaths(['path1', 'path2', 'path1', 'path3', 'path2', 'path4', 'path1']);

      expect(plugin.getQuickEditPaths()).toEqual(['path1', 'path2', 'path3', 'path4']);
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should work with setPanelOptions in method chain', () => {
      const plugin = getPanelPlugin({ id: 'test-panel' })
        .setPanelOptions((builder) => {
          builder.addSelect({
            path: 'displayMode',
            name: 'Display mode',
            settings: { options: [] },
          });
        })
        .setQuickEditPaths(['displayMode']);

      expect(plugin.getQuickEditPaths()).toEqual(['displayMode']);
    });
  });
});
