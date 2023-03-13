import { render, screen } from '@testing-library/react';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';

import { NavModel, NavModelItem } from '@grafana/data';
import { BackendSrv, setBackendSrv } from '@grafana/runtime';

import { createDashboardModelFixture } from '../../state/__fixtures__/dashboardFixtures';

import { DashboardSettings } from './DashboardSettings';

setBackendSrv({
  get: jest.fn().mockResolvedValue([]),
} as unknown as BackendSrv);

describe('DashboardSettings', () => {
  it('pressing escape navigates away correctly', async () => {
    const dashboard = createDashboardModelFixture(
      {
        title: 'Foo',
      },
      {
        folderId: 1,
      }
    );

    const sectionNav: NavModel = { main: { text: 'Dashboards' }, node: { text: 'Dashboards' } };
    const pageNav: NavModelItem = { text: 'My cool dashboard' };

    render(
      <TestProvider>
        <DashboardSettings editview="settings" dashboard={dashboard} sectionNav={sectionNav} pageNav={pageNav} />
      </TestProvider>
    );

    expect(await screen.findByRole('tab', { name: 'Tab Settings' })).toBeInTheDocument();
  });
});
