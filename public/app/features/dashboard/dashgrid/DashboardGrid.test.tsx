import { act, screen } from '@testing-library/react';
import { useEffectOnce } from 'react-use';
import { render } from 'test/test-utils';

import { TextBoxVariableModel } from '@grafana/data';
import { Dashboard } from '@grafana/schema';
import appEvents from 'app/core/app_events';
import { GetVariables } from 'app/features/variables/state/selectors';
import { VariablesChanged } from 'app/features/variables/types';
import { DashboardMeta } from 'app/types/dashboard';

import { DashboardModel } from '../state/DashboardModel';
import { createDashboardModelFixture } from '../state/__fixtures__/dashboardFixtures';

import { DashboardGrid, PANEL_FILTER_VARIABLE, Props } from './DashboardGrid';
import { Props as LazyLoaderProps } from './LazyLoader';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    featureToggles: {
      panelFilterVariable: true,
    },
  },
}));

jest.mock('app/features/dashboard/dashgrid/LazyLoader', () => {
  const LazyLoader = ({ children, onLoad }: Pick<LazyLoaderProps, 'children' | 'onLoad'>) => {
    useEffectOnce(() => {
      onLoad?.();
    });
    return <>{typeof children === 'function' ? children({ isInView: true }) : children}</>;
  };
  return { LazyLoader };
});

function setup(props: Props) {
  return render(<DashboardGrid {...props} />);
}

function getTestDashboard(
  overrides?: Partial<Dashboard>,
  metaOverrides?: Partial<DashboardMeta>,
  getVariablesFromState?: GetVariables
): DashboardModel {
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
          type: 'table',
          title: 'My table',
          gridPos: { x: 0, y: 10, w: 25, h: 10 },
        },
        {
          id: 3,
          type: 'table',
          title: 'My table 2',
          gridPos: { x: 0, y: 20, w: 25, h: 100 },
        },
        {
          id: 4,
          type: 'gauge',
          title: 'My gauge',
          gridPos: { x: 0, y: 120, w: 25, h: 10 },
        },
      ],
    },
    overrides
  );

  return createDashboardModelFixture(data, metaOverrides, getVariablesFromState);
}

describe('DashboardGrid', () => {
  it('Should render panels', async () => {
    const props: Props = {
      editPanel: null,
      viewPanel: null,
      isEditable: true,
      dashboard: getTestDashboard(),
    };

    act(() => {
      setup(props);
    });

    expect(await screen.findByText('My graph')).toBeInTheDocument();
    expect(await screen.findByText('My table')).toBeInTheDocument();
    expect(await screen.findByText('My table 2')).toBeInTheDocument();
    expect(await screen.findByText('My gauge')).toBeInTheDocument();
  });

  it('Should allow filtering panels', async () => {
    const props: Props = {
      editPanel: null,
      viewPanel: null,
      isEditable: true,
      dashboard: getTestDashboard(),
    };
    act(() => {
      setup(props);
    });

    act(() => {
      appEvents.publish(
        new VariablesChanged({
          panelIds: [],
          refreshAll: false,
          variable: {
            type: 'textbox',
            id: PANEL_FILTER_VARIABLE,
            current: {
              value: 'My graph',
            },
          } as TextBoxVariableModel,
        })
      );
    });
    const table = screen.queryByText('My table');
    const table2 = screen.queryByText('My table 2');
    const gauge = screen.queryByText('My gauge');

    expect(await screen.findByText('My graph')).toBeInTheDocument();
    expect(table).toBeNull();
    expect(table2).toBeNull();
    expect(gauge).toBeNull();
  });

  it('Should rendered filtered panels on init when filter variable is present', async () => {
    const props: Props = {
      editPanel: null,
      viewPanel: null,
      isEditable: true,
      dashboard: getTestDashboard(undefined, undefined, () => [
        {
          id: PANEL_FILTER_VARIABLE,
          type: 'textbox',
          query: 'My tab',
        } as TextBoxVariableModel,
      ]),
    };

    act(() => {
      setup(props);
    });

    const graph = screen.queryByText('My graph');
    const gauge = screen.queryByText('My gauge');

    expect(await screen.findByText('My table')).toBeInTheDocument();
    expect(await screen.findByText('My table 2')).toBeInTheDocument();
    expect(graph).toBeNull();
    expect(gauge).toBeNull();
  });
});
