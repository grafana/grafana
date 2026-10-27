import { act, render, screen } from '@testing-library/react';

import { type DataSourceInstanceSettings } from '@grafana/data';

import { DashboardAnnotationsDataLayer } from '../../scene/DashboardAnnotationsDataLayer';
import { DashboardDataLayerSet } from '../../scene/DashboardDataLayerSet';
import { DashboardScene } from '../../scene/DashboardScene';
import { activateFullSceneTree } from '../../utils/test-utils';

import { AnnotationQueryEditorModal } from './AnnotationQueryEditorModal';

const lokiDataSource = { uid: 'loki-uid', type: 'loki' } as DataSourceInstanceSettings;

jest.mock('app/features/datasources/components/picker/DataSourcePicker', () => ({
  DataSourcePicker: ({ onChange }: { onChange: (ds: DataSourceInstanceSettings) => void }) => (
    <button onClick={() => onChange(lokiDataSource)}>Pick Loki</button>
  ),
}));

describe('AnnotationQueryEditorModal', () => {
  it('keeps the control display settings when the data source type changes', async () => {
    const layer = new DashboardAnnotationsDataLayer({
      name: 'Deploys',
      isEnabled: false,
      query: {
        name: 'Deploys',
        enable: false,
        iconColor: 'red',
        datasource: { uid: 'prom-uid', type: 'prometheus' },
        hide: true,
        placement: 'inControlsMenu',
      } as DashboardAnnotationsDataLayer['state']['query'],
    });
    jest.spyOn(layer, 'runLayer').mockImplementation(() => undefined);
    const dashboard = new DashboardScene({
      isEditing: true,
      $data: new DashboardDataLayerSet({ annotationLayers: [layer] }),
    });
    const deactivate = activateFullSceneTree(dashboard);

    render(<AnnotationQueryEditorModal layer={layer} onClose={jest.fn()} />);
    // Let the query editor's async data source lookups settle
    await act(async () => {});

    await act(async () => screen.getByText('Pick Loki').click());

    expect(layer.state.query.datasource).toEqual({ uid: 'loki-uid', type: 'loki' });
    expect(layer.state.query.placement).toBe('inControlsMenu');
    expect(layer.state.query.hide).toBe(true);
    act(() => deactivate());
  });
});
