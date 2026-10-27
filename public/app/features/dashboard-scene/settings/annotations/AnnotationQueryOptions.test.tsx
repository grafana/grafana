import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type AnnotationQuery, type DataQuery, type DataSourceInstanceSettings } from '@grafana/data';

import { DashboardAnnotationsDataLayer } from '../../scene/DashboardAnnotationsDataLayer';
import { DashboardDataLayerSet } from '../../scene/DashboardDataLayerSet';
import { DashboardScene } from '../../scene/DashboardScene';
import { activateFullSceneTree } from '../../utils/test-utils';

import { AnnotationQueryEditorButton } from './AnnotationQueryOptions';

const mockOpenDrawer = jest.fn();
const savedQueryAnnotation: AnnotationQuery = { name: 'Anno', enable: true, iconColor: 'red', expr: 'saved' };
const editedAnnotation: AnnotationQuery = { name: 'Anno', enable: true, iconColor: 'red', expr: 'edited' };

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  // Like the real hook, it keeps returning the previous instance for a render after the ref changes
  useDataSourceInstance: (ref?: { uid?: string }) => {
    const { useEffect, useState } = jest.requireActual('react');
    const [dataSource, setDataSource] = useState({ uid: ref?.uid, annotations: {} });
    useEffect(() => {
      setDataSource((current: { uid?: string }) =>
        current.uid === ref?.uid ? current : { uid: ref?.uid, annotations: {} }
      );
    }, [ref?.uid]);
    return { dataSource };
  },
  useDataSourceInstanceSettings: () => ({ settings: {} }),
}));

jest.mock('app/features/explore/QueryLibrary/QueryLibraryContext', () => ({
  useQueryLibraryContext: () => ({ queryLibraryEnabled: true, openDrawer: mockOpenDrawer, closeDrawer: jest.fn() }),
}));

jest.mock('app/features/annotations/utils/savedQueryUtils', () => ({
  updateAnnotationFromSavedQuery: () => Promise.resolve(savedQueryAnnotation),
}));

jest.mock('app/features/datasources/components/picker/DataSourcePicker', () => ({
  DataSourcePicker: ({ onChange }: { onChange: (ds: Pick<DataSourceInstanceSettings, 'uid' | 'type'>) => void }) => (
    <button onClick={() => onChange({ uid: 'second', type: 'test' })}>Switch data source</button>
  ),
}));

let mockPreparedAnnotation: AnnotationQuery | undefined;
let mockPrepare: ((annotation: AnnotationQuery, dataSourceUid?: string) => AnnotationQuery) | undefined;

jest.mock('app/features/annotations/components/StandardAnnotationQueryEditor', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    __esModule: true,
    default: function MockEditor({
      onChange,
      annotation,
      datasource,
    }: {
      onChange: (annotation: AnnotationQuery) => void;
      annotation: AnnotationQuery;
      datasource: { uid?: string };
    }) {
      useEffect(() => {
        if (mockPreparedAnnotation) {
          onChange(mockPreparedAnnotation);
        }
      }, [onChange]);
      useEffect(() => {
        const prepared = mockPrepare?.(annotation, datasource.uid);
        if (prepared && prepared !== annotation) {
          onChange(prepared);
        }
      }, [annotation, datasource, onChange]);
      return (
        <>
          <button onClick={() => onChange({ name: 'Anno', enable: true, iconColor: 'red', expr: 'original' })}>
            Restore original query
          </button>
          <button
            onClick={() =>
              onChange(annotation.datasource ? { ...annotation, expr: 'edited after switch' } : editedAnnotation)
            }
          >
            Edit query
          </button>
        </>
      );
    },
  };
});

let deactivate: (() => void) | undefined;

function setup() {
  const layer = new DashboardAnnotationsDataLayer({
    name: 'Anno',
    isEnabled: true,
    isHidden: false,
    query: { name: 'Anno', enable: true, iconColor: 'red', expr: 'original' },
  });
  jest.spyOn(layer, 'runLayer').mockImplementation(() => {});
  const dashboard = new DashboardScene({
    isEditing: true,
    $data: new DashboardDataLayerSet({ annotationLayers: [layer] }),
  });
  deactivate = activateFullSceneTree(dashboard);

  render(<AnnotationQueryEditorButton layer={layer} />);

  return { layer, query: layer.state.query, sidebar: dashboard.state.sidebar, user: userEvent.setup() };
}

describe('AnnotationQueryEditorButton', () => {
  afterEach(() => {
    act(() => deactivate?.());
    jest.clearAllMocks();
    mockPreparedAnnotation = undefined;
    mockPrepare = undefined;
  });

  it('does not record the query preparation done by the editor when the modal opens', async () => {
    mockPreparedAnnotation = { name: 'Anno', enable: true, iconColor: 'red', target: { refId: 'Anno' } };
    const { layer, sidebar, user } = setup();

    await user.click(screen.getByRole('button', { name: 'Open query editor' }));
    await screen.findByRole('button', { name: 'Edit query' });
    expect(layer.state.query).toBe(mockPreparedAnnotation);

    await user.click(screen.getByText('Close'));
    expect(sidebar.state.undoStack).toHaveLength(0);
  });

  it('does not record edits that return to the original query content', async () => {
    const { layer, query, sidebar, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Open query editor' }));
    await user.click(await screen.findByRole('button', { name: 'Edit query' }));
    await user.click(screen.getByRole('button', { name: 'Restore original query' }));
    expect(layer.state.query).toEqual(query);
    expect(layer.state.query).not.toBe(query);
    await user.click(screen.getByText('Close'));
    expect(sidebar.state.undoStack).toHaveLength(0);
  });

  it('records user edits after preparation and undoes to the prepared query', async () => {
    mockPreparedAnnotation = { name: 'Anno', enable: true, iconColor: 'red', target: { refId: 'Anno' } };
    const { layer, sidebar, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Open query editor' }));
    await user.click(await screen.findByRole('button', { name: 'Edit query' }));
    await user.click(screen.getByText('Close'));
    expect(layer.state.query).toBe(editedAnnotation);
    expect(sidebar.state.undoStack).toHaveLength(1);
    act(() => sidebar.undoAction());
    expect(layer.state.query).toBe(mockPreparedAnnotation);
    act(() => sidebar.redoAction());
    expect(layer.state.query).toBe(editedAnnotation);
  });

  it('records query editor changes as one undoable action when the modal closes', async () => {
    const { layer, query, sidebar, user } = setup();

    await user.click(screen.getByRole('button', { name: 'Open query editor' }));
    await user.click(await screen.findByRole('button', { name: 'Edit query' }));
    expect(sidebar.state.undoStack).toHaveLength(0);

    await user.click(screen.getByText('Close'));
    expect(layer.state.query).toBe(editedAnnotation);
    expect(sidebar.state.undoStack).toHaveLength(1);

    act(() => sidebar.undoAction());
    expect(layer.state.query).toBe(query);

    act(() => sidebar.redoAction());
    expect(layer.state.query).toBe(editedAnnotation);
  });

  it('does not record anything when the modal closes without query changes', async () => {
    const { sidebar, user } = setup();

    await user.click(screen.getByRole('button', { name: 'Open query editor' }));
    await user.click(await screen.findByText('Close'));

    expect(sidebar.state.undoStack).toHaveLength(0);
  });

  it('records selecting a saved query as an undoable action', async () => {
    const { layer, query, sidebar, user } = setup();

    await user.click(screen.getByRole('button', { name: 'Use saved query' }));
    await act(() => mockOpenDrawer.mock.calls[0][0].onSelectQuery({ refId: 'A' } as DataQuery));
    expect(layer.state.query).toBe(savedQueryAnnotation);
    expect(sidebar.state.undoStack).toHaveLength(1);

    act(() => sidebar.undoAction());
    expect(layer.state.query).toBe(query);

    act(() => sidebar.redoAction());
    expect(layer.state.query).toBe(savedQueryAnnotation);
  });

  it('does not record the previous data source preparing the query after a data source change', async () => {
    // The data source the layer starts with adds its own target to queries that have none
    mockPrepare = (annotation, dataSourceUid) =>
      dataSourceUid === undefined && !annotation.target ? { ...annotation, target: { refId: 'first' } } : annotation;
    const { layer, sidebar, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Open query editor' }));
    await screen.findByRole('button', { name: 'Edit query' });
    const preparedQuery = layer.state.query;

    await user.click(screen.getByRole('button', { name: 'Switch data source' }));
    await user.click(screen.getByText('Close'));

    expect(layer.state.query).toEqual({
      datasource: { uid: 'second', type: 'test' },
      name: 'Anno',
      enable: true,
      iconColor: 'red',
    });
    expect(sidebar.state.undoStack.map((action) => action.meta.actionId)).toEqual(['annotation.changeDataSource']);
    act(() => sidebar.undoAction());
    expect(layer.state.query).toBe(preparedQuery);
  });

  it('undoes and redoes edits on both sides of a data source change in order', async () => {
    const { layer, query, sidebar, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Open query editor' }));
    await user.click(await screen.findByRole('button', { name: 'Edit query' }));
    await user.click(screen.getByRole('button', { name: 'Switch data source' }));
    const switchedQuery = layer.state.query;
    expect(switchedQuery.datasource).toEqual({ uid: 'second', type: 'test' });
    await user.click(screen.getByRole('button', { name: 'Edit query' }));
    await user.click(screen.getByText('Close'));
    expect(layer.state.query.expr).toBe('edited after switch');
    expect(sidebar.state.undoStack.map((action) => action.meta.actionId)).toEqual([
      'annotation.changeQuery',
      'annotation.changeDataSource',
      'annotation.changeQuery',
    ]);

    act(() => sidebar.undoAction());
    expect(layer.state.query).toBe(switchedQuery);
    act(() => sidebar.undoAction());
    expect(layer.state.query).toBe(editedAnnotation);
    act(() => sidebar.undoAction());
    expect(layer.state.query).toBe(query);

    act(() => sidebar.redoAction());
    expect(layer.state.query).toBe(editedAnnotation);
    act(() => sidebar.redoAction());
    expect(layer.state.query).toBe(switchedQuery);
    act(() => sidebar.redoAction());
    expect(layer.state.query).toMatchObject({
      datasource: { uid: 'second', type: 'test' },
      expr: 'edited after switch',
    });
    expect(sidebar.state.undoStack).toHaveLength(3);
  });
});
