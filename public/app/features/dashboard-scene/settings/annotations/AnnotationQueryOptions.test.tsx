import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type AnnotationQuery, type DataQuery } from '@grafana/data';

import { DashboardAnnotationsDataLayer } from '../../scene/DashboardAnnotationsDataLayer';
import { DashboardDataLayerSet } from '../../scene/DashboardDataLayerSet';
import { DashboardScene } from '../../scene/DashboardScene';
import { activateFullSceneTree } from '../../utils/test-utils';

import { AnnotationQueryEditorButton } from './AnnotationQueryOptions';

const mockOpenDrawer = jest.fn();
const savedQueryAnnotation: AnnotationQuery = { name: 'Anno', enable: true, iconColor: 'red', expr: 'saved' };
const editedAnnotation: AnnotationQuery = { name: 'Anno', enable: true, iconColor: 'red', expr: 'edited' };

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  useDataSourceInstance: () => ({ dataSource: { annotations: {} } }),
  useDataSourceInstanceSettings: () => ({ settings: {} }),
}));

jest.mock('app/features/explore/QueryLibrary/QueryLibraryContext', () => ({
  useQueryLibraryContext: () => ({ queryLibraryEnabled: true, openDrawer: mockOpenDrawer, closeDrawer: jest.fn() }),
}));

jest.mock('app/features/annotations/utils/savedQueryUtils', () => ({
  updateAnnotationFromSavedQuery: () => Promise.resolve(savedQueryAnnotation),
}));

jest.mock('app/features/datasources/components/picker/DataSourcePicker', () => ({
  DataSourcePicker: () => null,
}));

let mockPreparedAnnotation: AnnotationQuery | undefined;

jest.mock('app/features/annotations/components/StandardAnnotationQueryEditor', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    __esModule: true,
    default: function MockEditor({ onChange }: { onChange: (annotation: AnnotationQuery) => void }) {
      useEffect(() => {
        if (mockPreparedAnnotation) {
          onChange(mockPreparedAnnotation);
        }
      }, [onChange]);
      return <button onClick={() => onChange(editedAnnotation)}>Edit query</button>;
    },
  };
});

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
  activateFullSceneTree(dashboard);

  render(<AnnotationQueryEditorButton layer={layer} />);

  return { layer, query: layer.state.query, sidebar: dashboard.state.sidebar, user: userEvent.setup() };
}

describe('AnnotationQueryEditorButton', () => {
  afterEach(() => {
    jest.clearAllMocks();
    mockPreparedAnnotation = undefined;
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
});
