import { render, screen } from '@testing-library/react';
import React from 'react';

import { PanelModel } from '../dashboard/state';
import { createDashboardModelFixture, createPanelJSONFixture } from '../dashboard/state/__fixtures__/dashboardFixtures';

import { TestRuleResult } from './TestRuleResult';

const backendSrv = {
  post: jest.fn(),
};

jest.mock('@grafana/runtime', () => {
  const original = jest.requireActual('@grafana/runtime');

  return {
    ...original,
    getBackendSrv: () => backendSrv,
  };
});

const props: React.ComponentProps<typeof TestRuleResult> = {
  panel: new PanelModel({ id: 1 }),
  dashboard: createDashboardModelFixture({
    panels: [createPanelJSONFixture({ id: 1 })],
  }),
};

describe('TestRuleResult', () => {
  it('should render without error', async () => {
    render(<TestRuleResult {...props} />);
    await screen.findByRole('button', { name: 'Copy to Clipboard' });
  });

  it('should call testRule when mounting', async () => {
    jest.spyOn(backendSrv, 'post');
    render(<TestRuleResult {...props} />);
    await screen.findByRole('button', { name: 'Copy to Clipboard' });

    expect(backendSrv.post).toHaveBeenCalledWith(
      '/api/alerts/test',
      expect.objectContaining({
        panelId: 1,
      })
    );
  });
});
