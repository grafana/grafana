import { render, screen } from 'test/test-utils';

import { DashboardAnnotationsDataLayer } from './DashboardAnnotationsDataLayer';
import { DashboardDataLayerSet } from './DashboardDataLayerSet';
import { DashboardScene } from './DashboardScene';
import { SectionControlsRow } from './SectionAnnotationControls';
import { RowItem } from './layout-rows/RowItem';
import { RowsLayoutManager } from './layout-rows/RowsLayoutManager';

function annotationLayer(name: string, state: Partial<DashboardAnnotationsDataLayer['state']> = {}) {
  return new DashboardAnnotationsDataLayer({
    name,
    isEnabled: false,
    query: { name, enable: false, iconColor: 'red' },
    ...state,
  });
}

describe('SectionControlsRow', () => {
  it('shows layers placed in the controls menu, since sections have no controls menu, and not hidden layers', () => {
    const set = new DashboardDataLayerSet({
      annotationLayers: [
        annotationLayer('visible'),
        annotationLayer('menu', { placement: 'inControlsMenu' }),
        annotationLayer('hidden', { isHidden: true }),
      ],
    });
    new DashboardScene({ body: new RowsLayoutManager({ rows: [new RowItem({ $data: set })] }) });

    render(<SectionControlsRow data={set} />);

    expect(screen.getByText('visible')).toBeInTheDocument();
    expect(screen.getByText('menu')).toBeInTheDocument();
    expect(screen.queryByText('hidden')).not.toBeInTheDocument();
  });
});
