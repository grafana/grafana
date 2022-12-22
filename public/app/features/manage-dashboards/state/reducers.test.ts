import { LoadingState } from '@grafana/data';

import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { LibraryElementDTO } from '../../library-panels/types';

import {
  clearDashboard,
  DashboardSource,
  DataSourceInput,
  importDashboardReducer,
  ImportDashboardState,
  initialImportDashboardState,
  InputType,
  LibraryPanelInput,
  LibraryPanelInputState,
  setGcomDashboard,
  setInputs,
  setJsonDashboard,
  setLibraryPanelInputs,
} from './reducers';

describe('importDashboardReducer', () => {
  describe('when setGcomDashboard action is dispatched', () => {
    it('then resulting state should be correct', () => {
      reducerTester<ImportDashboardState>()
        .givenReducer(importDashboardReducer, { ...initialImportDashboardState })
        .whenActionIsDispatched(
          setGcomDashboard({ json: { id: 1, title: 'Imported' }, updatedAt: '2001-01-01', orgName: 'Some Org' })
        )
        .thenStateShouldEqual({
          ...initialImportDashboardState,
          dashboard: {
            title: 'Imported',
            id: null,
          },
          meta: { updatedAt: '2001-01-01', orgName: 'Some Org' },
          source: DashboardSource.Gcom,
          state: LoadingState.Done,
        });
    });
  });

  describe('when setJsonDashboard action is dispatched', () => {
    it('then resulting state should be correct', () => {
      reducerTester<ImportDashboardState>()
        .givenReducer(importDashboardReducer, { ...initialImportDashboardState, source: DashboardSource.Gcom })
        .whenActionIsDispatched(setJsonDashboard({ id: 1, title: 'Imported' }))
        .thenStateShouldEqual({
          ...initialImportDashboardState,
          dashboard: {
            title: 'Imported',
            id: null,
          },
          source: DashboardSource.Json,
          state: LoadingState.Done,
        });
    });
  });

  describe('when clearDashboard action is dispatched', () => {
    it('then resulting state should be correct', () => {
      reducerTester<ImportDashboardState>()
        .givenReducer(importDashboardReducer, {
          ...initialImportDashboardState,
          dashboard: {
            title: 'Imported',
            id: null,
          },
          state: LoadingState.Done,
        })
        .whenActionIsDispatched(clearDashboard())
        .thenStateShouldEqual({
          ...initialImportDashboardState,
          dashboard: {},
          state: LoadingState.NotStarted,
        });
    });
  });

  describe('when setInputs action is dispatched', () => {
    it('then resulting state should be correct', () => {
      reducerTester<ImportDashboardState>()
        .givenReducer(importDashboardReducer, { ...initialImportDashboardState })
        .whenActionIsDispatched(
          setInputs([
            { type: InputType.DataSource },
            { type: InputType.Constant },
            { type: InputType.LibraryPanel },
            { type: 'temp' },
          ])
        )
        .thenStateShouldEqual({
          ...initialImportDashboardState,
          inputs: {
            dataSources: [{ type: InputType.DataSource }] as DataSourceInput[],
            constants: [{ type: InputType.Constant }] as DataSourceInput[],
            libraryPanels: [],
          },
        });
    });
  });

  describe('when setLibraryPanelInputs action is dispatched', () => {
    it('then resulting state should be correct', () => {
      reducerTester<ImportDashboardState>()
        .givenReducer(importDashboardReducer, {
          ...initialImportDashboardState,
          inputs: {
            dataSources: [{ type: InputType.DataSource }] as DataSourceInput[],
            constants: [{ type: InputType.Constant }] as DataSourceInput[],
            libraryPanels: [{ model: { uid: 'asasAHSJ' } }] as LibraryPanelInput[],
          },
        })
        .whenActionIsDispatched(
          setLibraryPanelInputs([
            {
              model: { uid: 'sadjahsdk', name: 'A name', type: 'text' } as LibraryElementDTO,
              state: LibraryPanelInputState.Exists,
            },
          ])
        )
        .thenStateShouldEqual({
          ...initialImportDashboardState,
          inputs: {
            dataSources: [{ type: InputType.DataSource }] as DataSourceInput[],
            constants: [{ type: InputType.Constant }] as DataSourceInput[],
            libraryPanels: [
              {
                model: { uid: 'sadjahsdk', name: 'A name', type: 'text' } as LibraryElementDTO,
                state: LibraryPanelInputState.Exists,
              },
            ],
          },
        });
    });
  });
});
