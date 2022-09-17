import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { setAngularLoader, setDataSourceSrv } from '@grafana/runtime';
import { mockDataSource, MockDataSourceSrv } from 'app/features/alerting/unified/mocks';

import { DashboardModel } from '../../state/DashboardModel';

import { AnnotationSettingsEdit } from './AnnotationSettingsEdit';

function setup(dashboard: DashboardModel, editIndex: number) {
  return render(<AnnotationSettingsEdit dashboard={dashboard} editIdx={editIndex} />);
}

describe('AnnotationSettingsEdit', () => {
  let dashboard: DashboardModel;

  const dataSources = {
    grafana: mockDataSource(
      {
        name: 'Grafana',
        uid: 'uid1',
        type: 'grafana',
      },
      { annotations: true }
    ),
  };

  setDataSourceSrv(new MockDataSourceSrv(dataSources));

  beforeAll(() => {
    setAngularLoader({
      load: () => ({
        destroy: jest.fn(),
        digest: jest.fn(),
        getScope: () => ({ $watch: () => {} }),
      }),
    });
  });

  beforeEach(() => {
    dashboard = new DashboardModel({
      id: 74,
      version: 7,
      annotations: {
        list: [
          {
            builtIn: 1,
            datasource: { uid: 'uid1', type: 'grafana' },
            enable: true,
            hide: true,
            iconColor: 'rgba(0, 211, 255, 1)',
            name: 'Annotations & Alerts',
            type: 'dashboard',
          },
        ],
      },
      links: [],
    });
  });

  test(`Adding a new TagColor pair`, async () => {
    setup(dashboard, 0);

    await userEvent.click(screen.getByText(/Add tag color/i));
    expect(dashboard.annotations.list[0].tagColors?.length).toBe(1);

    // check defaults were set
    expect(dashboard.annotations.list[0].tagColors![0].color).toBe('green');
    expect(dashboard.annotations.list[0].tagColors![0].tags.length).toBe(0);
  });

  test(`Removing a TagColor`, async () => {
    setup(dashboard, 0);

    await userEvent.click(screen.getByText(/Add tag color/i));
    await userEvent.click(screen.getByRole('button', { name: 'Delete this tag color' }));

    expect(dashboard.annotations.list[0].tagColors?.length).toBe(0);
  });
});
