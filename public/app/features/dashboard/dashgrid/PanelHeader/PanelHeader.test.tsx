import { render, screen } from '@testing-library/react';
import React from 'react';

import { createEmptyQueryResponse } from '../../../explore/state/utils';
import { DashboardModel, PanelModel } from '../../state';

import { PanelHeader } from './PanelHeader';

let panelModel = new PanelModel({
  id: 1,
  gridPos: { x: 1, y: 1, w: 1, h: 1 },
  type: 'type',
  title: 'title',
});

let panelData = createEmptyQueryResponse();

describe('Panel Header', () => {
  const dashboardModel = new DashboardModel({}, { publicDashboardAccessToken: 'abc123' });
  it('will render header title but not render dropdown icon when dashboard is being viewed publicly', () => {
    window.history.pushState({}, 'Test Title', '/public-dashboards/abc123');

    render(
      <PanelHeader panel={panelModel} dashboard={dashboardModel} isViewing={false} isEditing={false} data={panelData} />
    );

    expect(screen.getByText('title')).toBeDefined();
    expect(screen.queryByTestId('panel-dropdown')).toBeNull();
  });

  it('will render header title and dropdown icon when dashboard is not being viewed publicly', () => {
    const dashboardModel = new DashboardModel({}, { publicDashboardAccessToken: '' });
    window.history.pushState({}, 'Test Title', '/d/abc/123');

    render(
      <PanelHeader panel={panelModel} dashboard={dashboardModel} isViewing={false} isEditing={false} data={panelData} />
    );

    expect(screen.getByText('title')).toBeDefined();
    expect(screen.getByTestId('panel-dropdown')).toBeDefined();
  });
});
