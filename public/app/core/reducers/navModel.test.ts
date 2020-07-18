import { reducerTester } from '../../../test/core/redux/reducerTester';
import { initialState, navIndexReducer, updateNavIndex, updateConfigurationSubtitle } from './navModel';
import { NavIndex } from '@grafana/data';

describe('navModelReducer', () => {
  describe('when updateNavIndex is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<NavIndex>()
        .givenReducer(navIndexReducer, { ...initialState })
        .whenActionIsDispatched(
          updateNavIndex({
            id: 'parent',
            text: 'Some Text',
            children: [
              {
                id: 'child',
                text: 'Child',
              },
            ],
          })
        )
        .thenStateShouldEqual({
          ...initialState,
          child: {
            id: 'child',
            text: 'Child',
            parentItem: {
              id: 'parent',
              text: 'Some Text',
              children: [
                {
                  id: 'child',
                  text: 'Child',
                },
              ],
            },
          },
        });
    });
  });

  describe('when updateConfigurationSubtitle is dispatched', () => {
    it('then state should be correct', () => {
      const orgName = 'New Org Name';
      const newCfgState = { ...initialState.cfg, subTitle: `Organization: ${orgName}` };
      const expectedState = {
        ...initialState,
        cfg: newCfgState,
        datasources: { ...initialState.datasources, parentItem: newCfgState },
        users: { ...initialState.users, parentItem: newCfgState },
        teams: { ...initialState.teams, parentItem: newCfgState },
        plugins: { ...initialState.plugins, parentItem: newCfgState },
        'org-settings': { ...initialState['org-settings'], parentItem: newCfgState },
        apikeys: { ...initialState.apikeys, parentItem: newCfgState },
      };

      reducerTester<NavIndex>()
        .givenReducer(navIndexReducer, { ...initialState })
        .whenActionIsDispatched(updateConfigurationSubtitle(orgName))
        .thenStateShouldEqual(expectedState);
    });
  });
});
