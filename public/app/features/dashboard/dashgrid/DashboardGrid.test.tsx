import React from 'react';
import { shallow, ShallowWrapper } from 'enzyme';
import { DashboardGrid, Props } from './DashboardGrid';
import { DashboardModel } from '../state';

interface ScenarioContext {
  props: Props;
  wrapper?: ShallowWrapper<Props, any, DashboardGrid>;
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
      setup: fn => {
        setupFn = fn;
      },
      props: {
        isEditing: false,
        isFullscreen: false,
        scrollTop: 0,
        dashboard: getTestDashboard(),
      },
      setProps: (props: Partial<Props>) => {
        Object.assign(ctx.props, props);
        if (ctx.wrapper) {
          ctx.wrapper.setProps(ctx.props);
        }
      },
    };

    beforeEach(() => {
      setupFn();
      ctx.wrapper = shallow(<DashboardGrid {...ctx.props} />);
    });

    scenarioFn(ctx);
  });
}

describe('DashboardGrid', () => {
  dashboardGridScenario('Can render dashboard grid', ctx => {
    ctx.setup(() => {});

    it('Should render', () => {
      expect(ctx.wrapper).toMatchSnapshot();
    });
  });
});
