import { screen } from '@testing-library/react';

import { VizPanel } from '@grafana/scenes';
import { DataQuery, DataTransformerConfig } from '@grafana/schema';

import { QueryEditorProvider } from '../QueryEditorContext';
import { ds1SettingsMock, mockActions, setup } from '../testUtils';

import { SidebarCard } from './SidebarCard';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getInstanceSettings: () => ds1SettingsMock,
  }),
}));

describe('SidebarCard', () => {
  afterAll(() => {
    jest.clearAllMocks();
  });

  it('should select query card and deselect transformation when clicking query card', async () => {
    const query: DataQuery = { refId: 'A', datasource: { type: 'test', uid: 'test' } };
    const transformation: DataTransformerConfig = { id: 'organize', options: {} };

    const setSelectedQuery = jest.fn();
    const setSelectedTransformation = jest.fn();

    const { user } = setup(
      <QueryEditorProvider
        dsState={{ datasource: undefined, dsSettings: undefined, dsError: undefined }}
        qrState={{ queries: [query], data: undefined, isLoading: false }}
        panelState={{ panel: new VizPanel({ key: 'panel-1' }), transformations: [transformation] }}
        uiState={{
          selectedQuery: null,
          selectedTransformation: transformation,
          setSelectedQuery,
          setSelectedTransformation,
        }}
        actions={mockActions}
      >
        <SidebarCard query={query} />
      </QueryEditorProvider>
    );

    const queryCard = screen.getByRole('button', { name: /select card A/i });
    await user.click(queryCard);

    expect(setSelectedQuery).toHaveBeenCalledWith(query);
    expect(setSelectedTransformation).not.toHaveBeenCalled();
  });

  it('should select transformation card and deselect query when clicking transformation card', async () => {
    const query: DataQuery = { refId: 'A', datasource: { type: 'test', uid: 'test' } };
    const transformation: DataTransformerConfig = { id: 'organize', options: {} };

    const setSelectedQuery = jest.fn();
    const setSelectedTransformation = jest.fn();

    const { user } = setup(
      <QueryEditorProvider
        dsState={{ datasource: undefined, dsSettings: undefined, dsError: undefined }}
        qrState={{ queries: [query], data: undefined, isLoading: false }}
        panelState={{ panel: new VizPanel({ key: 'panel-1' }), transformations: [transformation] }}
        uiState={{
          selectedQuery: query,
          selectedTransformation: null,
          setSelectedQuery,
          setSelectedTransformation,
        }}
        actions={mockActions}
      >
        <SidebarCard query={transformation} />
      </QueryEditorProvider>
    );

    const transformCard = screen.getByRole('button', { name: /select card organize/i });
    await user.click(transformCard);

    expect(setSelectedTransformation).toHaveBeenCalledWith(transformation);
    expect(setSelectedQuery).not.toHaveBeenCalled();
  });

  it('should not deselect when clicking already selected card', async () => {
    const query: DataQuery = { refId: 'A', datasource: { type: 'test', uid: 'test' } };

    const setSelectedQuery = jest.fn();
    const setSelectedTransformation = jest.fn();

    const { user } = setup(
      <QueryEditorProvider
        dsState={{ datasource: undefined, dsSettings: undefined, dsError: undefined }}
        qrState={{ queries: [query], data: undefined, isLoading: false }}
        panelState={{ panel: new VizPanel({ key: 'panel-1' }), transformations: [] }}
        uiState={{
          selectedQuery: query,
          selectedTransformation: null,
          setSelectedQuery,
          setSelectedTransformation,
        }}
        actions={mockActions}
      >
        <SidebarCard query={query} />
      </QueryEditorProvider>
    );

    const queryCard = screen.getByRole('button', { name: /select card A/i });
    await user.click(queryCard);

    // Should not call setSelectedQuery again since it's already selected
    expect(setSelectedQuery).not.toHaveBeenCalled();
  });
});
