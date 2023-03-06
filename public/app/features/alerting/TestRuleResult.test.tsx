import { render } from '@testing-library/react';
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
  it('should render without error', () => {
    expect(() => render(<TestRuleResult {...props} />)).not.toThrow();
  });

  it('should call testRule when mounting', () => {
    jest.spyOn(backendSrv, 'post');
    render(<TestRuleResult {...props} />);

    expect(backendSrv.post).toHaveBeenCalledWith(
      '/api/alerts/test',
      expect.objectContaining({
        panelId: 1,
      })
    );
  });
});
