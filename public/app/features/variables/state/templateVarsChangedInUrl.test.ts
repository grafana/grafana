import { variableAdapters } from '../adapters';
import { customBuilder } from '../shared/testing/builders';
import { DashboardState, StoreState } from '../../../types';
import { initialState } from '../../dashboard/state/reducers';
import { TemplatingState } from './reducers';
import { ExtendedUrlQueryMap } from '../utils';
import { templateVarsChangedInUrl } from './actions';
import { createCustomVariableAdapter } from '../custom/adapter';
import { VariablesState } from './types';
import { DashboardModel } from '../../dashboard/state';

const dashboardModel = new DashboardModel({});

variableAdapters.setInit(() => [createCustomVariableAdapter()]);

async function getTestContext(urlQueryMap: ExtendedUrlQueryMap = {}) {
  jest.clearAllMocks();

  const custom = customBuilder().withId('custom').withCurrent(['A', 'C']).withOptions('A', 'B', 'C').build();
  const setValueFromUrlMock = jest.fn();
  variableAdapters.get('custom').setValueFromUrl = setValueFromUrlMock;

  const templateVariableValueUpdatedMock = jest.fn();
  const startRefreshMock = jest.fn();
  const dashboard: DashboardState = {
    ...initialState,
    getModel: () => {
      dashboardModel.templateVariableValueUpdated = templateVariableValueUpdatedMock;
      dashboardModel.startRefresh = startRefreshMock;
      dashboardModel.templating = { list: [custom] };
      return dashboardModel;
    },
  };

  const variables: VariablesState = { custom };
  const templating = ({ variables } as unknown) as TemplatingState;
  const state: Partial<StoreState> = {
    dashboard,
    templating,
  };
  const getState = () => (state as unknown) as StoreState;

  const dispatch = jest.fn();
  const thunk = templateVarsChangedInUrl(urlQueryMap);

  await thunk(dispatch, getState, undefined);

  return { setValueFromUrlMock, templateVariableValueUpdatedMock, startRefreshMock, custom };
}

describe('templateVarsChangedInUrl', () => {
  describe('when called with no variables in url query map', () => {
    it('then no value should change and dashboard should not be refreshed', async () => {
      const { setValueFromUrlMock, templateVariableValueUpdatedMock, startRefreshMock } = await getTestContext();

      expect(setValueFromUrlMock).not.toHaveBeenCalled();
      expect(templateVariableValueUpdatedMock).not.toHaveBeenCalled();
      expect(startRefreshMock).not.toHaveBeenCalled();
    });
  });

  describe('when called with no variables in url query map matching variables in state', () => {
    it('then no value should change and dashboard should not be refreshed', async () => {
      const { setValueFromUrlMock, templateVariableValueUpdatedMock, startRefreshMock } = await getTestContext({
        'var-query': { value: 'A' },
      });

      expect(setValueFromUrlMock).not.toHaveBeenCalled();
      expect(templateVariableValueUpdatedMock).not.toHaveBeenCalled();
      expect(startRefreshMock).not.toHaveBeenCalled();
    });
  });

  describe('when called with variables in url query map matching variables in state', () => {
    describe('and the values in url query map are the same as current in state', () => {
      it('then no value should change and dashboard should not be refreshed', async () => {
        const { setValueFromUrlMock, templateVariableValueUpdatedMock, startRefreshMock } = await getTestContext({
          'var-custom': { value: ['A', 'C'] },
        });

        expect(setValueFromUrlMock).not.toHaveBeenCalled();
        expect(templateVariableValueUpdatedMock).not.toHaveBeenCalled();
        expect(startRefreshMock).not.toHaveBeenCalled();
      });
    });

    describe('and the values in url query map are the not the same as current in state', () => {
      it('then the value should change to the value in url query map and dashboard should be refreshed', async () => {
        const {
          setValueFromUrlMock,
          templateVariableValueUpdatedMock,
          startRefreshMock,
          custom,
        } = await getTestContext({
          'var-custom': { value: 'B' },
        });

        expect(setValueFromUrlMock).toHaveBeenCalledTimes(1);
        expect(setValueFromUrlMock).toHaveBeenCalledWith(custom, 'B');
        expect(templateVariableValueUpdatedMock).toHaveBeenCalledTimes(1);
        expect(startRefreshMock).toHaveBeenCalledTimes(1);
      });

      describe('but the values in url query map were removed', () => {
        it('then the value should change to the value in dashboard json and dashboard should be refreshed', async () => {
          const {
            setValueFromUrlMock,
            templateVariableValueUpdatedMock,
            startRefreshMock,
            custom,
          } = await getTestContext({
            'var-custom': { value: '', removed: true },
          });

          expect(setValueFromUrlMock).toHaveBeenCalledTimes(1);
          expect(setValueFromUrlMock).toHaveBeenCalledWith(custom, ['A', 'C']);
          expect(templateVariableValueUpdatedMock).toHaveBeenCalledTimes(1);
          expect(startRefreshMock).toHaveBeenCalledTimes(1);
        });
      });
    });
  });
});
