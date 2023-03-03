import { LoadingState } from '@grafana/data';
import { DashboardSearchItem } from 'app/features/search/types';

import { reducerTester } from '../../../../../test/core/redux/reducerTester';

import {
  deleteLibraryPanelModalReducer,
  DeleteLibraryPanelModalState,
  initialDeleteLibraryPanelModalState,
  searchCompleted,
} from './reducer';

describe('deleteLibraryPanelModalReducer', () => {
  describe('when created', () => {
    it('then initial state should be correct', () => {
      reducerTester<DeleteLibraryPanelModalState>()
        .givenReducer(deleteLibraryPanelModalReducer, initialDeleteLibraryPanelModalState)
        .whenActionIsDispatched({ type: 'noop' })
        .thenStateShouldEqual({
          loadingState: LoadingState.Loading,
          dashboardTitles: [],
        });
    });
  });

  describe('when searchCompleted is dispatched', () => {
    it('then state should be correct', () => {
      const dashboards = [{ title: 'A' }, { title: 'B' }] as DashboardSearchItem[];
      reducerTester<DeleteLibraryPanelModalState>()
        .givenReducer(deleteLibraryPanelModalReducer, initialDeleteLibraryPanelModalState)
        .whenActionIsDispatched(searchCompleted({ dashboards }))
        .thenStateShouldEqual({
          loadingState: LoadingState.Done,
          dashboardTitles: ['A', 'B'],
        });
    });
  });
});
