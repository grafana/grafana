import { thunkTester } from 'test/core/thunk/thunkTester';

import { dateTime, ExploreUrlState } from '@grafana/data';
import { serializeStateToUrlParam } from '@grafana/data/src/utils/url';
import { locationService } from '@grafana/runtime';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';

import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { MockDataSourceApi } from '../../../../test/mocks/datasource_srv';
import { configureStore } from '../../../store/configureStore';
import { ExploreItemState, ExploreState, StoreState, ThunkDispatch } from '../../../types';

import { exploreReducer, navigateToExplore, splitClose, splitOpen } from './main';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getInstanceSettings: jest.fn().mockReturnValue({}),
  }),
}));

const getNavigateToExploreContext = async (openInNewWindow?: (url: string) => void) => {
  const url = '/explore';
  const panel: Partial<PanelModel> = {
    datasource: { uid: 'mocked datasource' },
    targets: [{ refId: 'A' }],
  };
  const datasource = new MockDataSourceApi(panel.datasource!.uid!);
  const get = jest.fn().mockResolvedValue(datasource);
  const getExploreUrl = jest.fn().mockResolvedValue(url);
  const timeRange = { from: dateTime(), to: dateTime() };

  const dispatchedActions = await thunkTester({})
    .givenThunk(navigateToExplore)
    .whenThunkIsDispatched(panel, { timeRange, getExploreUrl, openInNewWindow });

  return {
    url,
    panel,
    get,
    timeRange,
    getExploreUrl,
    dispatchedActions,
  };
};

describe('navigateToExplore', () => {
  describe('when navigateToExplore thunk is dispatched', () => {
    describe('and openInNewWindow is undefined', () => {
      it('then it should dispatch correct actions', async () => {
        const { url } = await getNavigateToExploreContext();
        expect(locationService.getLocation().pathname).toEqual(url);
      });

      it('then getExploreUrl should have been called with correct arguments', async () => {
        const { getExploreUrl, panel, timeRange } = await getNavigateToExploreContext();

        expect(getExploreUrl).toHaveBeenCalledTimes(1);
        expect(getExploreUrl).toHaveBeenCalledWith({
          queries: panel.targets,
          timeRange,
          dsRef: panel.datasource,
          adhocFilters: [],
        });
      });
    });

    describe('and openInNewWindow is defined', () => {
      const openInNewWindow: (url: string) => void = jest.fn();
      it('then it should dispatch no actions', async () => {
        const { dispatchedActions } = await getNavigateToExploreContext(openInNewWindow);

        expect(dispatchedActions).toEqual([]);
      });

      it('then getExploreUrl should have been called with correct arguments', async () => {
        const { getExploreUrl, panel, timeRange } = await getNavigateToExploreContext(openInNewWindow);

        expect(getExploreUrl).toHaveBeenCalledTimes(1);
        expect(getExploreUrl).toHaveBeenCalledWith({
          queries: panel.targets,
          timeRange,
          dsRef: panel.datasource,
          adhocFilters: [],
        });
      });

      it('then openInNewWindow should have been called with correct arguments', async () => {
        const openInNewWindowFunc = jest.fn();
        const { url } = await getNavigateToExploreContext(openInNewWindowFunc);

        expect(openInNewWindowFunc).toHaveBeenCalledTimes(1);
        expect(openInNewWindowFunc).toHaveBeenCalledWith(url);
      });
    });
  });
});

describe('Explore reducer', () => {
  describe('split view', () => {
    describe('split open', () => {
      it('it should create only ony new pane', async () => {
        let dispatch: ThunkDispatch, getState: () => StoreState;

        const store: { dispatch: ThunkDispatch; getState: () => StoreState } = configureStore({
          explore: {
            panes: {
              one: { queries: [], range: {} },
            },
          },
        } as unknown as Partial<StoreState>);

        dispatch = store.dispatch;
        getState = store.getState;

        await dispatch(splitOpen());
        let splitPanes = Object.keys(getState().explore.panes);
        expect(splitPanes).toHaveLength(2);
        let secondSplitPaneId = splitPanes[1];

        await dispatch(splitOpen());
        splitPanes = Object.keys(getState().explore.panes);
        // only 2 panes exist...
        expect(splitPanes).toHaveLength(2);
        // ...and the second pane is replaced
        expect(splitPanes[0]).toBe('one');
        expect(splitPanes[1]).not.toBe(secondSplitPaneId);
      });
    });
    describe('split close', () => {
      it('should reset right pane when it is closed', () => {
        const leftItemMock = {
          containerWidth: 100,
        } as unknown as ExploreItemState;

        const rightItemMock = {
          containerWidth: 200,
        } as unknown as ExploreItemState;

        const initialState = {
          panes: {
            left: leftItemMock,
            right: rightItemMock,
          },
        } as unknown as ExploreState;

        // closing left item
        reducerTester<ExploreState>()
          .givenReducer(exploreReducer, initialState)
          .whenActionIsDispatched(splitClose('right'))
          .thenStateShouldEqual({
            evenSplitPanes: true,
            largerExploreId: undefined,
            panes: {
              left: leftItemMock,
            },
            maxedExploreId: undefined,
            syncedTimes: false,
          } as unknown as ExploreState);
      });

      it('should unsync time ranges', () => {
        const itemMock = {
          containerWidth: 100,
        } as unknown as ExploreItemState;

        const initialState = {
          panes: {
            right: itemMock,
            left: itemMock,
          },
          syncedTimes: true,
        } as unknown as ExploreState;

        reducerTester<ExploreState>()
          .givenReducer(exploreReducer, initialState)
          .whenActionIsDispatched(splitClose('right'))
          .thenStateShouldEqual({
            evenSplitPanes: true,
            panes: {
              left: itemMock,
            },
            syncedTimes: false,
          } as unknown as ExploreState);
      });
    });
  });
});

export const setup = (urlStateOverrides?: Partial<ExploreUrlState>) => {
  const urlStateDefaults: ExploreUrlState = {
    datasource: 'some-datasource',
    queries: [],
    range: {
      from: '',
      to: '',
    },
  };
  const urlState: ExploreUrlState = { ...urlStateDefaults, ...urlStateOverrides };
  const serializedUrlState = serializeStateToUrlParam(urlState);
  const initialState = {
    split: false,
  } as unknown as ExploreState;

  return {
    initialState,
    serializedUrlState,
  };
};
