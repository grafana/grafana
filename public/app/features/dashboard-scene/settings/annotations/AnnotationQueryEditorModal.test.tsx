import { act, render, screen } from '@testing-library/react';

import { type DataSourceInstanceSettings } from '@grafana/data';

import { DashboardAnnotationsDataLayer } from '../../scene/DashboardAnnotationsDataLayer';

import { AnnotationQueryEditorModal } from './AnnotationQueryEditorModal';
import { isAnnotationLabelHidden } from './annotationDisplay';

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
        placement: 'inControlsMenu',
        hideLabel: true,
      } as DashboardAnnotationsDataLayer['state']['query'],
    });
    jest.spyOn(layer, 'runLayer').mockImplementation(() => undefined);

    render(<AnnotationQueryEditorModal layer={layer} onClose={jest.fn()} />);
    // Let the query editor's async data source lookups settle
    await act(async () => {});

    await act(async () => screen.getByText('Pick Loki').click());

    expect(layer.state.query.datasource).toEqual({ uid: 'loki-uid', type: 'loki' });
    expect(layer.state.query.placement).toBe('inControlsMenu');
    expect(isAnnotationLabelHidden(layer.state.query)).toBe(true);
  });
});
