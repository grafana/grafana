import { serializeStateToUrlParam } from '@grafana/data/src/utils/url';
import { exploreReducer, initialExploreState, navigateToExplore, splitCloseAction, splitOpenAction } from './main';
import { thunkTester } from 'test/core/thunk/thunkTester';
import { PanelModel } from 'app/features/dashboard/state';
import { updateLocation } from '../../../core/actions';
import { MockDataSourceApi } from '../../../../test/mocks/datasource_srv';
import { ExploreId, ExploreItemState, ExploreState } from '../../../types';
import { makeExplorePaneState, makeInitialUpdateState } from './utils';
import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { ExploreUrlState, UrlQueryMap } from '@grafana/data';

const getNavigateToExploreContext = async (openInNewWindow?: (url: string) => void) => {
  const url = 'http://www.someurl.com';
  const panel: Partial<PanelModel> = {
    datasource: 'mocked datasource',
    targets: [{ refId: 'A' }],
  };
  const datasource = new MockDataSourceApi(panel.datasource!);
  const get = jest.fn().mockResolvedValue(datasource);
  const getDataSourceSrv = jest.fn().mockReturnValue({ get });
  const getTimeSrv = jest.fn();
  const getExploreUrl = jest.fn().mockResolvedValue(url);

  const dispatchedActions = await thunkTester({})
    .givenThunk(navigateToExplore)
    .whenThunkIsDispatched(panel, { getDataSourceSrv, getTimeSrv, getExploreUrl, openInNewWindow });

  return {
    url,
    panel,
    datasource,
    get,
    getDataSourceSrv,
    getTimeSrv,
    getExploreUrl,
    dispatchedActions,
  };
};

describe('navigateToExplore', () => {
  describe('when navigateToExplore thunk is dispatched', () => {
    describe('and openInNewWindow is undefined', () => {
      const openInNewWindow: (url: string) => void = (undefined as unknown) as (url: string) => void;
      it('then it should dispatch correct actions', async () => {
        const { dispatchedActions, url } = await getNavigateToExploreContext(openInNewWindow);

        expect(dispatchedActions).toEqual([updateLocation({ path: url, query: {} })]);
      });

      it('then getDataSourceSrv should have been once', async () => {
        const { getDataSourceSrv } = await getNavigateToExploreContext(openInNewWindow);

        expect(getDataSourceSrv).toHaveBeenCalledTimes(1);
      });

      it('then getDataSourceSrv.get should have been called with correct arguments', async () => {
        const { get, panel } = await getNavigateToExploreContext(openInNewWindow);

        expect(get).toHaveBeenCalledTimes(1);
        expect(get).toHaveBeenCalledWith(panel.datasource);
      });

      it('then getTimeSrv should have been called once', async () => {
        const { getTimeSrv } = await getNavigateToExploreContext(openInNewWindow);

        expect(getTimeSrv).toHaveBeenCalledTimes(1);
      });

      it('then getExploreUrl should have been called with correct arguments', async () => {
        const { getExploreUrl, panel, datasource, getDataSourceSrv, getTimeSrv } = await getNavigateToExploreContext(
          openInNewWindow
        );

        expect(getExploreUrl).toHaveBeenCalledTimes(1);
        expect(getExploreUrl).toHaveBeenCalledWith({
          panel,
          panelTargets: panel.targets,
          panelDatasource: datasource,
          datasourceSrv: getDataSourceSrv(),
          timeSrv: getTimeSrv(),
        });
      });
    });

    describe('and openInNewWindow is defined', () => {
      const openInNewWindow: (url: string) => void = jest.fn();
      it('then it should dispatch no actions', async () => {
        const { dispatchedActions } = await getNavigateToExploreContext(openInNewWindow);

        expect(dispatchedActions).toEqual([]);
      });

      it('then getDataSourceSrv should have been once', async () => {
        const { getDataSourceSrv } = await getNavigateToExploreContext(openInNewWindow);

        expect(getDataSourceSrv).toHaveBeenCalledTimes(1);
      });

      it('then getDataSourceSrv.get should have been called with correct arguments', async () => {
        const { get, panel } = await getNavigateToExploreContext(openInNewWindow);

        expect(get).toHaveBeenCalledTimes(1);
        expect(get).toHaveBeenCalledWith(panel.datasource);
      });

      it('then getTimeSrv should have been called once', async () => {
        const { getTimeSrv } = await getNavigateToExploreContext(openInNewWindow);

        expect(getTimeSrv).toHaveBeenCalledTimes(1);
      });

      it('then getExploreUrl should have been called with correct arguments', async () => {
        const { getExploreUrl, panel, datasource, getDataSourceSrv, getTimeSrv } = await getNavigateToExploreContext(
          openInNewWindow
        );

        expect(getExploreUrl).toHaveBeenCalledTimes(1);
        expect(getExploreUrl).toHaveBeenCalledWith({
          panel,
          panelTargets: panel.targets,
          panelDatasource: datasource,
          datasourceSrv: getDataSourceSrv(),
          timeSrv: getTimeSrv(),
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
    it("should make right pane a duplicate of the given item's state on split open", () => {
      const leftItemMock = ({
        containerWidth: 100,
      } as unknown) as ExploreItemState;

      const initialState = ({
        split: null,
        left: leftItemMock as ExploreItemState,
        right: makeExplorePaneState(),
      } as unknown) as ExploreState;

      reducerTester<ExploreState>()
        .givenReducer(exploreReducer, initialState)
        .whenActionIsDispatched(splitOpenAction({ itemState: leftItemMock }))
        .thenStateShouldEqual(({
          split: true,
          left: leftItemMock,
          right: leftItemMock,
        } as unknown) as ExploreState);
    });

    describe('split close', () => {
      it('should keep right pane as left when left is closed', () => {
        const leftItemMock = ({
          containerWidth: 100,
        } as unknown) as ExploreItemState;

        const rightItemMock = ({
          containerWidth: 200,
        } as unknown) as ExploreItemState;

        const initialState = ({
          split: null,
          left: leftItemMock,
          right: rightItemMock,
        } as unknown) as ExploreState;

        // closing left item
        reducerTester<ExploreState>()
          .givenReducer(exploreReducer, initialState)
          .whenActionIsDispatched(splitCloseAction({ itemId: ExploreId.left }))
          .thenStateShouldEqual(({
            split: false,
            left: rightItemMock,
            right: initialExploreState.right,
          } as unknown) as ExploreState);
      });
      it('should reset right pane when it is closed ', () => {
        const leftItemMock = ({
          containerWidth: 100,
        } as unknown) as ExploreItemState;

        const rightItemMock = ({
          containerWidth: 200,
        } as unknown) as ExploreItemState;

        const initialState = ({
          split: null,
          left: leftItemMock,
          right: rightItemMock,
        } as unknown) as ExploreState;

        // closing left item
        reducerTester<ExploreState>()
          .givenReducer(exploreReducer, initialState)
          .whenActionIsDispatched(splitCloseAction({ itemId: ExploreId.right }))
          .thenStateShouldEqual(({
            split: false,
            left: leftItemMock,
            right: initialExploreState.right,
          } as unknown) as ExploreState);
      });
    });
  });

  describe('when updateLocation is dispatched', () => {
    describe('and payload does not contain a query', () => {
      it('then it should just return state', () => {
        reducerTester<ExploreState>()
          .givenReducer(exploreReducer, ({} as unknown) as ExploreState)
          .whenActionIsDispatched(updateLocation({ query: (null as unknown) as UrlQueryMap }))
          .thenStateShouldEqual(({} as unknown) as ExploreState);
      });
    });

    describe('and payload contains a query', () => {
      describe("but does not contain 'left'", () => {
        it('then it should just return state', () => {
          reducerTester<ExploreState>()
            .givenReducer(exploreReducer, ({} as unknown) as ExploreState)
            .whenActionIsDispatched(updateLocation({ query: {} }))
            .thenStateShouldEqual(({} as unknown) as ExploreState);
        });
      });

      describe("and query contains a 'right'", () => {
        it('then it should add split in state', () => {
          const { initialState, serializedUrlState } = setup();
          const expectedState = { ...initialState, split: true };

          reducerTester<ExploreState>()
            .givenReducer(exploreReducer, initialState)
            .whenActionIsDispatched(
              updateLocation({
                query: {
                  left: serializedUrlState,
                  right: serializedUrlState,
                },
              })
            )
            .thenStateShouldEqual(expectedState);
        });
      });

      describe("and query contains a 'left'", () => {
        describe('but urlState is not set in state', () => {
          it('then it should just add urlState and update in state', () => {
            const { initialState, serializedUrlState } = setup();
            const urlState: ExploreUrlState = (null as unknown) as ExploreUrlState;
            const stateWithoutUrlState = ({ ...initialState, left: { urlState } } as unknown) as ExploreState;
            const expectedState = { ...initialState };

            reducerTester<ExploreState>()
              .givenReducer(exploreReducer, stateWithoutUrlState)
              .whenActionIsDispatched(
                updateLocation({
                  query: {
                    left: serializedUrlState,
                  },
                  path: '/explore',
                })
              )
              .thenStateShouldEqual(expectedState);
          });
        });

        describe("but '/explore' is missing in path", () => {
          it('then it should just add urlState and update in state', () => {
            const { initialState, serializedUrlState } = setup();
            const expectedState = { ...initialState };

            reducerTester<ExploreState>()
              .givenReducer(exploreReducer, initialState)
              .whenActionIsDispatched(
                updateLocation({
                  query: {
                    left: serializedUrlState,
                  },
                  path: '/dashboard',
                })
              )
              .thenStateShouldEqual(expectedState);
          });
        });

        describe("and '/explore' is in path", () => {
          describe('and datasource differs', () => {
            it('then it should return update datasource', () => {
              const { initialState, serializedUrlState } = setup();
              const expectedState = {
                ...initialState,
                left: {
                  ...initialState.left,
                  update: {
                    ...initialState.left.update,
                    datasource: true,
                  },
                },
              };
              const stateWithDifferentDataSource: any = {
                ...initialState,
                left: {
                  ...initialState.left,
                  urlState: {
                    ...initialState.left.urlState,
                    datasource: 'different datasource',
                  },
                },
              };

              reducerTester<ExploreState>()
                .givenReducer(exploreReducer, stateWithDifferentDataSource)
                .whenActionIsDispatched(
                  updateLocation({
                    query: {
                      left: serializedUrlState,
                    },
                    path: '/explore',
                  })
                )
                .thenStateShouldEqual(expectedState);
            });
          });

          describe('and range differs', () => {
            it('then it should return update range', () => {
              const { initialState, serializedUrlState } = setup();
              const expectedState = {
                ...initialState,
                left: {
                  ...initialState.left,
                  update: {
                    ...initialState.left.update,
                    range: true,
                  },
                },
              };
              const stateWithDifferentDataSource: any = {
                ...initialState,
                left: {
                  ...initialState.left,
                  urlState: {
                    ...initialState.left.urlState,
                    range: {
                      from: 'now',
                      to: 'now-6h',
                    },
                  },
                },
              };

              reducerTester<ExploreState>()
                .givenReducer(exploreReducer, stateWithDifferentDataSource)
                .whenActionIsDispatched(
                  updateLocation({
                    query: {
                      left: serializedUrlState,
                    },
                    path: '/explore',
                  })
                )
                .thenStateShouldEqual(expectedState);
            });
          });

          describe('and queries differs', () => {
            it('then it should return update queries', () => {
              const { initialState, serializedUrlState } = setup();
              const expectedState = {
                ...initialState,
                left: {
                  ...initialState.left,
                  update: {
                    ...initialState.left.update,
                    queries: true,
                  },
                },
              };
              const stateWithDifferentDataSource: any = {
                ...initialState,
                left: {
                  ...initialState.left,
                  urlState: {
                    ...initialState.left.urlState,
                    queries: [{ expr: '{__filename__="some.log"}' }],
                  },
                },
              };

              reducerTester<ExploreState>()
                .givenReducer(exploreReducer, stateWithDifferentDataSource)
                .whenActionIsDispatched(
                  updateLocation({
                    query: {
                      left: serializedUrlState,
                    },
                    path: '/explore',
                  })
                )
                .thenStateShouldEqual(expectedState);
            });
          });

          describe('and nothing differs', () => {
            it('then it should return update ui', () => {
              const { initialState, serializedUrlState } = setup();
              const expectedState = { ...initialState };

              reducerTester<ExploreState>()
                .givenReducer(exploreReducer, initialState)
                .whenActionIsDispatched(
                  updateLocation({
                    query: {
                      left: serializedUrlState,
                    },
                    path: '/explore',
                  })
                )
                .thenStateShouldEqual(expectedState);
            });
          });
        });
      });
    });
  });
});

export const setup = (urlStateOverrides?: any) => {
  const update = makeInitialUpdateState();
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
  const initialState = ({
    split: false,
    left: { urlState, update },
    right: { urlState, update },
  } as unknown) as ExploreState;

  return {
    initialState,
    serializedUrlState,
  };
};
