import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { mockComboboxRect } from '@grafana/test-utils';

import { DashboardAnnotationsDataLayer } from '../../scene/DashboardAnnotationsDataLayer';
import { DashboardDataLayerSet } from '../../scene/DashboardDataLayerSet';
import { DashboardScene } from '../../scene/DashboardScene';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { TabItem } from '../../scene/layout-tabs/TabItem';

import { AnnotationControlsDisplayPicker } from './AnnotationBasicOptions';
import { annotationEditActions } from './actions';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn(() => ({
    get: jest.fn().mockResolvedValue({}),
    getList: jest.fn(),
    getInstanceSettings: jest.fn(),
    reload: jest.fn(),
  })),
}));

beforeAll(() => {
  mockComboboxRect();
});

function layerOnTab() {
  const layer = new DashboardAnnotationsDataLayer({
    name: 'Deploys',
    isHidden: false,
    query: { name: 'Deploys', enable: true, iconColor: 'red' },
  });
  const data = new DashboardDataLayerSet({ annotationLayers: [layer] });
  new TabItem({ title: 'New tab', $data: data, layout: AutoGridLayoutManager.createEmpty() });
  return layer;
}

function layerOnDashboard() {
  const layer = new DashboardAnnotationsDataLayer({
    name: 'Deploys',
    isHidden: false,
    query: { name: 'Deploys', enable: true, iconColor: 'red' },
  });
  new DashboardScene({ $data: new DashboardDataLayerSet({ annotationLayers: [layer] }) });
  return layer;
}

describe('AnnotationControlsDisplayPicker', () => {
  it('offers the section placement, label hidden, and hidden for a tab annotation', async () => {
    const user = userEvent.setup();
    render(<AnnotationControlsDisplayPicker layer={layerOnTab()} />);

    await user.click(screen.getByRole('combobox'));

    expect(await screen.findByText('Top of tab')).toBeInTheDocument();
    expect(screen.getByText('Top of tab, label hidden')).toBeInTheDocument();
    expect(screen.getByText('Hidden')).toBeInTheDocument();
    expect(screen.queryByText('Controls menu')).not.toBeInTheDocument();
  });

  it('keeps controls menu for a dashboard annotation', async () => {
    const user = userEvent.setup();
    render(<AnnotationControlsDisplayPicker layer={layerOnDashboard()} />);

    await user.click(screen.getByRole('combobox'));

    expect(await screen.findByText('Above dashboard')).toBeInTheDocument();
    expect(screen.getByText('Above dashboard, label hidden')).toBeInTheDocument();
    expect(screen.getByText('Controls menu')).toBeInTheDocument();
    expect(screen.getByText('Hidden')).toBeInTheDocument();
  });

  it('stores label hidden without hiding the control', async () => {
    const user = userEvent.setup();
    const layer = layerOnTab();
    const spy = jest.spyOn(annotationEditActions, 'changeAnnotationControlsDisplay').mockImplementation(() => {});
    render(<AnnotationControlsDisplayPicker layer={layer} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByText('Top of tab, label hidden'));

    expect(spy).toHaveBeenCalledWith({
      source: layer,
      oldValue: { isHidden: false, placement: undefined, hideLabel: false },
      newValue: { isHidden: false, placement: undefined, hideLabel: true },
    });
    spy.mockRestore();
  });
});
