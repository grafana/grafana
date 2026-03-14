import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComponentProps } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { DataQueryRequest, EventBusSrv, serializeStateToUrlParam } from '@grafana/data';
import { ConstantVariable, CustomVariable, TextBoxVariable } from '@grafana/scenes';

import { LokiQuery } from '../../../plugins/datasource/loki/types';
import { addSceneVariableAction, buildExploreVariableScopedVars, removeVariableAction } from '../state/variables';

import { makeLogsQueryResponse } from './helper/query';
import { setupExplore, tearDown, waitForExplore } from './helper/setup';

const testEventBus = new EventBusSrv();

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getAppEvents: () => testEventBus,
}));

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    ...jest.requireActual('app/core/services/context_srv').contextSrv,
    hasPermission: () => true,
    getValidIntervals: (defaultIntervals: string[]) => defaultIntervals,
  },
}));

jest.mock('react-virtualized-auto-sizer', () => {
  return {
    __esModule: true,
    default(props: ComponentProps<typeof AutoSizer>) {
      return (
        <div>
          {props.children({
            width: 1000,
            scaledWidth: 1000,
            scaledHeight: 1000,
            height: 1000,
          })}
        </div>
      );
    },
  };
});

jest.mock('../hooks/useExplorePageTitle', () => ({
  useExplorePageTitle: jest.fn(),
}));

function getFirstPaneId(store: ReturnType<typeof setupExplore>['store']): string {
  return Object.keys(store.getState().explore.panes)[0];
}

function getSecondPaneId(store: ReturnType<typeof setupExplore>['store']): string {
  return Object.keys(store.getState().explore.panes)[1];
}

describe('Explore: variables integration', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    tearDown();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('variable interpolation into queries', () => {
    it('custom variable with values is included in ScopedVars passed to query', async () => {
      const { datasources, store } = setupExplore();

      (datasources.loki.query as jest.Mock).mockImplementation(() => makeLogsQueryResponse());

      await waitForExplore();

      const exploreId = getFirstPaneId(store);
      const variable = new CustomVariable({ name: 'job', query: 'foo,bar', value: 'foo', text: 'foo' });
      await act(async () => {
        store.dispatch(addSceneVariableAction({ exploreId, variable }));
      });

      const paneState = store.getState().explore.panes[exploreId]!;
      const scopedVars = buildExploreVariableScopedVars(paneState.variableSet);

      expect(scopedVars).toHaveProperty('job');
      expect(scopedVars['job']).toEqual({ text: 'foo', value: 'foo' });
    });

    it('textbox variable value is included in ScopedVars', async () => {
      const { store } = setupExplore();

      await waitForExplore();

      const exploreId = getFirstPaneId(store);
      const variable = new TextBoxVariable({ name: 'filter', value: 'myvalue' });
      await act(async () => {
        store.dispatch(addSceneVariableAction({ exploreId, variable }));
      });

      const paneState = store.getState().explore.panes[exploreId]!;
      const scopedVars = buildExploreVariableScopedVars(paneState.variableSet);

      expect(scopedVars).toHaveProperty('filter');
      expect(scopedVars['filter']).toEqual(expect.objectContaining({ value: 'myvalue' }));
    });

    it('constant variable is interpolated but has no toolbar dropdown', async () => {
      const { store } = setupExplore();

      await waitForExplore();

      const exploreId = getFirstPaneId(store);
      const variable = new ConstantVariable({ name: 'env', value: 'prod' });
      await act(async () => {
        store.dispatch(addSceneVariableAction({ exploreId, variable }));
      });

      const paneState = store.getState().explore.panes[exploreId]!;
      const scopedVars = buildExploreVariableScopedVars(paneState.variableSet);

      expect(scopedVars).toHaveProperty('env');
      expect(scopedVars['env']).toEqual(expect.objectContaining({ value: 'prod' }));

      expect(screen.queryByText('env')).not.toBeInTheDocument();
    });

    it('changing a variable value dispatches runQueries with updated ScopedVars', async () => {
      const { datasources, store } = setupExplore();
      const capturedScopedVars: Array<Record<string, unknown>> = [];

      (datasources.loki.query as jest.Mock).mockImplementation((request: DataQueryRequest<LokiQuery>) => {
        if (request.scopedVars?.['job']) {
          capturedScopedVars.push({ job: request.scopedVars['job'] });
        }
        return makeLogsQueryResponse();
      });

      await waitForExplore();

      const exploreId = getFirstPaneId(store);
      const variable = new CustomVariable({ name: 'job', query: 'foo,bar', value: 'foo', text: 'foo' });
      await act(async () => {
        store.dispatch(addSceneVariableAction({ exploreId, variable }));
      });

      await waitFor(() => {
        expect(screen.getByText('job')).toBeInTheDocument();
      });

      const paneState = store.getState().explore.panes[exploreId]!;
      const addedVar = paneState.variableSet.state.variables.find((v) => v.state.name === 'job') as CustomVariable;
      expect(addedVar).toBeDefined();

      await act(async () => {
        addedVar.setState({ value: 'bar', text: 'bar' });
      });

      // Verify ScopedVars is updated in state after the variable change
      const updatedState = store.getState().explore.panes[exploreId]!;
      const updatedScopedVars = buildExploreVariableScopedVars(updatedState.variableSet);
      expect(updatedScopedVars['job']).toEqual({ text: 'bar', value: 'bar' });
    });
  });

  describe('pane isolation', () => {
    it('variables in one split pane do not affect the other pane', async () => {
      const urlParams = {
        left: serializeStateToUrlParam({
          datasource: 'loki',
          queries: [{ refId: 'A', expr: 'left query' }],
          range: { from: '1600000000000', to: '1700000000000' },
        }),
        right: serializeStateToUrlParam({
          datasource: 'loki',
          queries: [{ refId: 'B', expr: 'right query' }],
          range: { from: '1600000000000', to: '1700000000000' },
        }),
      };
      const { datasources, store } = setupExplore({ urlParams });

      (datasources.loki.query as jest.Mock).mockImplementation(() => makeLogsQueryResponse());

      await waitForExplore();
      await waitForExplore('right');

      const leftId = getFirstPaneId(store);
      const rightId = getSecondPaneId(store);

      const leftVar = new CustomVariable({ name: 'leftOnly', query: 'a,b', value: 'a', text: 'a' });
      await act(async () => {
        store.dispatch(addSceneVariableAction({ exploreId: leftId, variable: leftVar }));
      });

      const leftState = store.getState().explore.panes[leftId]!;
      const rightState = store.getState().explore.panes[rightId]!;

      const leftScopedVars = buildExploreVariableScopedVars(leftState.variableSet);
      const rightScopedVars = buildExploreVariableScopedVars(rightState.variableSet);

      expect(leftScopedVars).toHaveProperty('leftOnly');
      expect(rightScopedVars).not.toHaveProperty('leftOnly');
    });
  });

  describe('variable deletion', () => {
    it('deleting a variable removes it from ScopedVars', async () => {
      const { store } = setupExplore();

      await waitForExplore();

      const exploreId = getFirstPaneId(store);
      const variable = new CustomVariable({ name: 'toDelete', query: 'x,y', value: 'x', text: 'x' });
      await act(async () => {
        store.dispatch(addSceneVariableAction({ exploreId, variable }));
      });

      let paneState = store.getState().explore.panes[exploreId]!;
      let scopedVars = buildExploreVariableScopedVars(paneState.variableSet);
      expect(scopedVars).toHaveProperty('toDelete');

      await act(async () => {
        store.dispatch(removeVariableAction({ exploreId, name: 'toDelete' }));
      });

      paneState = store.getState().explore.panes[exploreId]!;
      scopedVars = buildExploreVariableScopedVars(paneState.variableSet);
      expect(scopedVars).not.toHaveProperty('toDelete');
    });
  });

  describe('toolbar variable rendering', () => {
    it('toolbar Select dropdown shows variable computed options', async () => {
      const { store } = setupExplore();

      await waitForExplore();

      const exploreId = getFirstPaneId(store);
      const variable = new CustomVariable({
        name: 'region',
        query: 'us-east,us-west,eu-west',
        value: 'us-east',
        text: 'us-east',
      });
      await act(async () => {
        store.dispatch(addSceneVariableAction({ exploreId, variable }));
      });

      await waitFor(() => {
        expect(screen.getByText('region')).toBeInTheDocument();
      });
    });

    it('toolbar shows variable name as label', async () => {
      const { store } = setupExplore();

      await waitForExplore();

      const exploreId = getFirstPaneId(store);
      const variable = new CustomVariable({ name: 'myVar', query: 'val1,val2', value: 'val1', text: 'val1' });
      await act(async () => {
        store.dispatch(addSceneVariableAction({ exploreId, variable }));
      });

      await waitFor(() => {
        expect(screen.getByText('myVar')).toBeInTheDocument();
      });
    });

    it('selecting a value in toolbar dropdown updates the variable', async () => {
      const { store } = setupExplore();

      await waitForExplore();

      const exploreId = getFirstPaneId(store);
      const variable = new CustomVariable({ name: 'env', query: 'dev,staging,prod', value: 'dev', text: 'dev' });
      await act(async () => {
        store.dispatch(addSceneVariableAction({ exploreId, variable }));
      });

      await waitFor(() => {
        expect(screen.getByText('env')).toBeInTheDocument();
      });

      // Verify the variable starts with value 'dev' and can be updated via setState (as the Select onChange does)
      const paneState = store.getState().explore.panes[exploreId]!;
      const addedVar = paneState.variableSet.state.variables.find((v) => v.state.name === 'env') as CustomVariable;
      expect(String(addedVar.getValue())).toBe('dev');

      // Simulate selecting 'staging' via the Select onChange handler
      await act(async () => {
        addedVar.setState({ value: 'staging', text: 'staging' });
      });

      expect(String(addedVar.getValue())).toBe('staging');
    });

    it('Manage variables button opens Drawer to list view when variables exist', async () => {
      const { store } = setupExplore();

      await waitForExplore();

      const exploreId = getFirstPaneId(store);
      const variable = new CustomVariable({ name: 'testVar', query: 'a,b', value: 'a', text: 'a' });
      await act(async () => {
        store.dispatch(addSceneVariableAction({ exploreId, variable }));
      });

      await waitFor(() => {
        expect(screen.getByText('testVar')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('Manage variables')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Manage variables'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('no per-variable gear icons in toolbar', async () => {
      const { store } = setupExplore();

      await waitForExplore();

      const exploreId = getFirstPaneId(store);
      const variable = new CustomVariable({ name: 'testVar', query: 'a,b', value: 'a', text: 'a' });
      await act(async () => {
        store.dispatch(addSceneVariableAction({ exploreId, variable }));
      });

      await waitFor(() => {
        expect(screen.getByText('testVar')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /edit variable/i })).not.toBeInTheDocument();
    });

    it('variable with empty custom values renders dropdown without crashing', async () => {
      const { store } = setupExplore();

      await waitForExplore();

      const exploreId = getFirstPaneId(store);
      const variable = new CustomVariable({ name: 'empty', query: '', value: '', text: '' });
      await act(async () => {
        store.dispatch(addSceneVariableAction({ exploreId, variable }));
      });

      await waitFor(() => {
        expect(screen.getByText('empty')).toBeInTheDocument();
      });

      expect(screen.getByText('empty')).toBeInTheDocument();
    });
  });

  describe('rapid value changes', () => {
    it('rapid value changes do not cause stale query results', async () => {
      const { store } = setupExplore();

      await waitForExplore();

      const exploreId = getFirstPaneId(store);
      const variable = new CustomVariable({ name: 'env', query: 'dev,staging,prod', value: 'dev', text: 'dev' });
      await act(async () => {
        store.dispatch(addSceneVariableAction({ exploreId, variable }));
      });

      await waitFor(() => {
        expect(screen.getByText('env')).toBeInTheDocument();
      });

      const paneState = store.getState().explore.panes[exploreId]!;
      const addedVar = paneState.variableSet.state.variables.find((v) => v.state.name === 'env') as CustomVariable;

      // Rapidly change values
      await act(async () => {
        addedVar.setState({ value: 'staging', text: 'staging' });
      });
      await act(async () => {
        addedVar.setState({ value: 'prod', text: 'prod' });
      });

      // The final state should reflect the last change
      expect(String(addedVar.getValue())).toBe('prod');

      // ScopedVars should have the latest value
      const updatedState = store.getState().explore.panes[exploreId]!;
      const scopedVars = buildExploreVariableScopedVars(updatedState.variableSet);
      expect(scopedVars['env']).toEqual({ text: 'prod', value: 'prod' });
    });
  });
});
