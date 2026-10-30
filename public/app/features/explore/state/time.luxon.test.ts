const mockTimeSrv = {
  init: jest.fn(),
};
jest.mock('app/features/dashboard/services/TimeSrv', () => ({
  ...jest.requireActual('app/features/dashboard/services/TimeSrv'),
  getTimeSrv: () => mockTimeSrv,
}));

const mockTemplateSrv = {
  updateTimeRange: jest.fn(),
};
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => mockTemplateSrv,
}));

describe('Explore time range with Luxon', () => {
  it('normalizes fractional millisecond timestamps', async () => {
    await jest.isolateModulesAsync(async () => {
      const [{ configureStore }, { initialExploreState }, { updateTime }, { makeExplorePaneState }] = await Promise.all(
        [import('app/store/configureStore'), import('./main'), import('./time'), import('./utils')]
      );
      const store = configureStore({
        explore: {
          ...initialExploreState,
          panes: { left: makeExplorePaneState() },
        },
      });

      store.dispatch(
        updateTime({
          exploreId: 'left',
          absoluteRange: {
            from: 1787318699146.3264,
            to: 1787318699250.8,
          },
        })
      );

      expect(store.getState().explore.panes.left!.absoluteRange).toEqual({
        from: 1787318699146,
        to: 1787318699250,
      });
    });
  });
});
