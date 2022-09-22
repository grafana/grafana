import { render } from '@testing-library/react';
import React from 'react';

import { DashboardMeta } from 'app/types';

import { DashboardModel } from '../state';

import { DashboardGridUnconnected as DashboardGrid, Props } from './DashboardGrid';

jest.mock('app/features/dashboard/dashgrid/LazyLoader', () => {
  const LazyLoader: React.FC = ({ children }) => {
    return <>{children}</>;
  };
  return { LazyLoader };
});

function getTestDashboard(overrides?: any, metaOverrides?: Partial<DashboardMeta>): DashboardModel {
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

describe('DashboardGrid', () => {
  it('should render without error', () => {
    const props: Props = {
      editPanel: null,
      viewPanel: null,
      dashboard: getTestDashboard(),
      cleanAndRemoveMany: jest.fn,
    };
    expect(() => render(<DashboardGrid {...props} />)).not.toThrow();
  });
});
