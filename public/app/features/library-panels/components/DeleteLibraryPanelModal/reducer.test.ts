import { LoadingState } from '@grafana/data';
import { DashboardQueryResult } from 'app/features/search/service/types';

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
      const dashboards = [{ name: 'A' }, { name: 'B' }] as DashboardQueryResult[];
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
