import { reducerTester } from '../../../../../test/core/redux/reducerTester';
import {
  folderFilterChanged,
  initialLibraryPanelsSearchState,
  libraryPanelsSearchReducer,
  LibraryPanelsSearchState,
  panelFilterChanged,
  searchChanged,
  sortChanged,
} from './reducer';

describe('libraryPanelsSearchReducer', () => {
  describe('when searchChanged is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<LibraryPanelsSearchState>()
        .givenReducer(libraryPanelsSearchReducer, {
          ...initialLibraryPanelsSearchState,
        })
        .whenActionIsDispatched(searchChanged('searching for'))
        .thenStateShouldEqual({
          ...initialLibraryPanelsSearchState,
          searchQuery: 'searching for',
        });
    });
  });

  describe('when sortChanged is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<LibraryPanelsSearchState>()
        .givenReducer(libraryPanelsSearchReducer, {
          ...initialLibraryPanelsSearchState,
        })
        .whenActionIsDispatched(sortChanged({ label: 'Ascending', value: 'asc' }))
        .thenStateShouldEqual({
          ...initialLibraryPanelsSearchState,
          sortDirection: 'asc',
        });
    });
  });

  describe('when panelFilterChanged is dispatched', () => {
    it('then state should be correct', () => {
      const plugins: any = [
        { id: 'graph', name: 'Graph' },
        { id: 'timeseries', name: 'Time Series' },
      ];
      reducerTester<LibraryPanelsSearchState>()
        .givenReducer(libraryPanelsSearchReducer, {
          ...initialLibraryPanelsSearchState,
        })
        .whenActionIsDispatched(panelFilterChanged(plugins))
        .thenStateShouldEqual({
          ...initialLibraryPanelsSearchState,
          panelFilter: ['graph', 'timeseries'],
        });
    });
  });

  describe('when folderFilterChanged is dispatched', () => {
    it('then state should be correct', () => {
      const folders: any = [
        { id: 0, name: 'General' },
        { id: 1, name: 'Folder' },
      ];
      reducerTester<LibraryPanelsSearchState>()
        .givenReducer(libraryPanelsSearchReducer, {
          ...initialLibraryPanelsSearchState,
        })
        .whenActionIsDispatched(folderFilterChanged(folders))
        .thenStateShouldEqual({
          ...initialLibraryPanelsSearchState,
          folderFilter: ['0', '1'],
        });
    });
  });
});
