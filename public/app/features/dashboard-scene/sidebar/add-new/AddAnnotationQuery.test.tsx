import { waitFor } from '@testing-library/react';
import { render, screen, userEvent } from 'test/test-utils';

import { DashboardAnnotationsDataLayer } from '../../scene/DashboardAnnotationsDataLayer';
import { DashboardDataLayerSet } from '../../scene/DashboardDataLayerSet';
import { DashboardScene } from '../../scene/DashboardScene';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { TabItem } from '../../scene/layout-tabs/TabItem';
import { annotationEditActions } from '../../settings/annotations/actions';

import { AddAnnotationQuery } from './AddAnnotationQuery';

jest.mock('../../settings/annotations/actions', () => ({
  annotationEditActions: { addAnnotation: jest.fn() },
}));

const addAnnotationMock = jest.mocked(annotationEditActions.addAnnotation);

const newLayer = new DashboardAnnotationsDataLayer({
  name: 'New annotation',
  isEnabled: true,
  query: { name: 'New annotation', enable: true, iconColor: 'red' },
});

describe('AddAnnotationQuery', () => {
  beforeEach(() => {
    addAnnotationMock.mockClear();
    jest.spyOn(DashboardDataLayerSet.prototype, 'createDefaultAnnotationLayer').mockResolvedValue(newLayer);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('adds the annotation to the selected tab', async () => {
    const dashboardLayers = new DashboardDataLayerSet({ annotationLayers: [] });
    const tab = new TabItem({ title: 'Overview', layout: AutoGridLayoutManager.createEmpty() });
    const dashboard = new DashboardScene({
      $data: dashboardLayers,
      body: AutoGridLayoutManager.createEmpty(),
    });

    render(<AddAnnotationQuery dashboardScene={dashboard} selectedElement={tab} />);
    await userEvent.click(screen.getByRole('button', { name: 'Annotation query' }));

    await waitFor(() => expect(addAnnotationMock).toHaveBeenCalledTimes(1));
    expect(addAnnotationMock.mock.calls[0][0].source).toBe(tab.state.$data);
    expect(addAnnotationMock.mock.calls[0][0].source).not.toBe(dashboardLayers);
  });

  it('adds the annotation to the dashboard when no section is selected', async () => {
    const dashboardLayers = new DashboardDataLayerSet({ annotationLayers: [] });
    const dashboard = new DashboardScene({
      $data: dashboardLayers,
      body: AutoGridLayoutManager.createEmpty(),
    });

    render(<AddAnnotationQuery dashboardScene={dashboard} />);
    await userEvent.click(screen.getByRole('button', { name: 'Annotation query' }));

    await waitFor(() => expect(addAnnotationMock).toHaveBeenCalledTimes(1));
    expect(addAnnotationMock.mock.calls[0][0].source).toBe(dashboardLayers);
  });
});
