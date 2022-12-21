import { render } from '@testing-library/react';
import React from 'react';

import { PanelModel } from '../dashboard/state';
import { createDashboardModelFixture, createPanelJSONFixture } from '../dashboard/state/__fixtures__/dashboardFixtures';

import { TestRuleResult, Props } from './TestRuleResult';

jest.mock('@grafana/runtime', () => {
  const original = jest.requireActual('@grafana/runtime');

  return {
    ...original,
    getBackendSrv: () => ({
      post: jest.fn(),
    }),
  };
});

const props: Props = {
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
    jest.spyOn(TestRuleResult.prototype, 'testRule');
    render(<TestRuleResult {...props} />);

    expect(TestRuleResult.prototype.testRule).toHaveBeenCalled();
  });
});
