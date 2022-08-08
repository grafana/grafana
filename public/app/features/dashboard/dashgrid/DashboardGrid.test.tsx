import { render } from '@testing-library/react';
import React from 'react';

import { DashboardModel } from '../state';

import { DashboardGridUnconnected as DashboardGrid, Props } from './DashboardGrid';

jest.mock('app/features/dashboard/dashgrid/LazyLoader', () => {
  const LazyLoader: React.FC = ({ children }) => {
    return <>{children}</>;
  };
  return { LazyLoader };
});

interface ScenarioContext {
  props: Props;
  setup: (fn: () => void) => void;
  setProps: (props: Partial<Props>) => void;
}

function getTestDashboard(overrides?: any, metaOverrides?: any): DashboardModel {
  const data = Object.assign(
    {
      title: 'My dashboard',
      panels: [
        {
          id: 1,
          type: 'graph',
          title: 'My graph',
          gridPos: { x: 0, y: 0, w: 24, h: 10 },
        },
        {
          id: 2,
          type: 'graph2',
          title: 'My graph2',
          gridPos: { x: 0, y: 10, w: 25, h: 10 },
        },
        {
          id: 3,
          type: 'graph3',
          title: 'My graph3',
          gridPos: { x: 0, y: 20, w: 25, h: 100 },
        },
        {
          id: 4,
          type: 'graph4',
          title: 'My graph4',
          gridPos: { x: 0, y: 120, w: 25, h: 10 },
        },
      ],
    },
    overrides
  );

  const meta = Object.assign({ canSave: true, canEdit: true }, metaOverrides);
  return new DashboardModel(data, meta);
}

function dashboardGridScenario(description: string, scenarioFn: (ctx: ScenarioContext) => void) {
  describe(description, () => {
    let setupFn: () => void;

    const ctx: ScenarioContext = {
      setup: (fn) => {
        setupFn = fn;
      },
      props: {
        editPanel: null,
        viewPanel: null,
        dashboard: getTestDashboard(),
        cleanAndRemoveMany: jest.fn,
      },
      setProps: (props: Partial<Props>) => {
        Object.assign(ctx.props, props);
        if (ctx) {
          ctx.setProps(ctx.props);
        }
      },
    };

    beforeEach(() => {
      setupFn();
      render(<DashboardGrid {...ctx.props} />);
    });

    scenarioFn(ctx);
  });
}

describe('DashboardGrid', () => {
  dashboardGridScenario('should', (ctx) => {
    ctx.setup(() => {});
    it('render without error', () => {
      expect(() => render(<DashboardGrid {...ctx.props} />)).not.toThrow();
    });
  });
});
