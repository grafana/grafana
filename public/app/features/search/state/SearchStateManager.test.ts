import { locationService } from '@grafana/runtime';

import { SearchLayout } from '../types';

import { getSearchStateManager } from './SearchStateManager';

describe('SearchStateManager', () => {
  it('Can get search state manager with initial state', async () => {
    const stm = getSearchStateManager();
    expect(stm.state.layout).toBe(SearchLayout.Folders);
  });

  describe('initStateFromUrl', () => {
    it('should read and set state from URL and trigger search', async () => {
      const stm = getSearchStateManager();
      locationService.partial({ query: 'test', tag: ['tag1', 'tag2'] });
      stm.initStateFromUrl();
      expect(stm.state.folderUid).toBe(undefined);
      expect(stm.state.query).toBe('test');
      expect(stm.state.tag).toEqual(['tag1', 'tag2']);
    });

    it('should init or clear folderUid', async () => {
      const stm = getSearchStateManager();
      stm.initStateFromUrl('asdsadas');
      expect(stm.state.folderUid).toBe('asdsadas');

      stm.initStateFromUrl();
      expect(stm.state.folderUid).toBe(undefined);
    });
  });
});
