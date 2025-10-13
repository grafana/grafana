import { act, fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import configureMockStore from 'redux-mock-store';
import { ReplaySubject } from 'rxjs';

import { EventBusSrv, getDefaultTimeRange, LoadingState, PanelData, PanelPlugin } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { PanelQueryRunner } from '../../query/state/PanelQueryRunner';
import { setTimeSrv, TimeSrv } from '../services/TimeSrv';
import { DashboardModel } from '../state/DashboardModel';
import { PanelModel } from '../state/PanelModel';

import { PanelStateWrapper, Props } from './PanelStateWrapper';

jest.mock('app/core/profiler', () => ({
  profiler: {
    renderingCompleted: jest.fn(),
  },
}));

function setupTestContext(options: Partial<Props>) {
  const mockStore = configureMockStore();
  const store = mockStore({ dashboard: { panels: [] } });
  const subject: ReplaySubject<PanelData> = new ReplaySubject<PanelData>();
  const panelQueryRunner = {
    getData: () => subject,
    run: () => {
      subject.next({ state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() });
    },
  } as unknown as PanelQueryRunner;
  const timeSrv = {
    timeRange: jest.fn(),
  } as unknown as TimeSrv;
  setTimeSrv(timeSrv);

  const defaults: Props = {
    panel: new PanelModel({
      id: 123,
      hasTitle: jest.fn(),
      replaceVariables: jest.fn(),
      events: new EventBusSrv(),
      getQueryRunner: () => panelQueryRunner,
      getOptions: jest.fn(),
      getDisplayTitle: jest.fn(),
    }),
    dashboard: {
      panelInitialized: jest.fn(),
      getTimezone: () => 'browser',
      events: new EventBusSrv(),
      canAddAnnotations: jest.fn(),
      canEditAnnotations: jest.fn(),
      canDeleteAnnotations: jest.fn(),
      meta: {
        isPublic: false,
      },
    } as unknown as DashboardModel,
    plugin: {
      meta: { skipDataQuery: false },
      panel: TestPanelComponent,
    } as unknown as PanelPlugin,
    isViewing: true,
    isEditing: false,
    isInView: false,
    width: 100,
    height: 100,
    onInstanceStateChange: () => {},
  };

  const props = { ...defaults, ...options };
  const { rerender } = render(
    <Provider store={store}>
      <PanelStateWrapper {...props} />
    </Provider>
  );

  // Needed so mocks work
  props.panel.refreshWhenInView = false;
  return { rerender, props, subject, store };
}

describe('PanelStateWrapper', () => {
  describe('when the user scrolls by a panel so fast that it starts loading data but scrolls out of view', () => {
    it('then it should load the panel successfully when scrolled into view again', () => {
      const { rerender, props, subject, store } = setupTestContext({});

      expect(screen.queryByText(/plugin panel to render/i)).not.toBeInTheDocument();

      act(() => {
        subject.next({ state: LoadingState.Loading, series: [], timeRange: getDefaultTimeRange() });
        subject.next({ state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() });
      });

      const newProps = { ...props, isInView: true };
      rerender(
        <Provider store={store}>
          <PanelStateWrapper {...newProps} />
        </Provider>
      );

      expect(screen.getByText(/plugin panel to render/i)).toBeInTheDocument();
    });
  });

  describe('when there are error(s)', () => {
    [
      { errors: [{ message: 'boom!' }], expectedMessage: 'boom!' },
      {
        errors: [{ message: 'boom!' }, { message: 'boom2!' }],
        expectedMessage: 'Multiple errors found. Click for more details',
      },
    ].forEach((scenario) => {
      it(`then it should show the error message: ${scenario.expectedMessage}`, async () => {
        const { rerender, props, subject, store } = setupTestContext({});

        act(() => {
          subject.next({ state: LoadingState.Loading, series: [], timeRange: getDefaultTimeRange() });
          subject.next({
            state: LoadingState.Error,
            series: [],
            errors: scenario.errors,
            timeRange: getDefaultTimeRange(),
          });
        });

        const newProps = { ...props, isInView: true };
        rerender(
          <Provider store={store}>
            <PanelStateWrapper {...newProps} />
          </Provider>
        );

        const button = screen.getByTestId(selectors.components.Panels.Panel.status('error'));
        expect(button).toBeInTheDocument();
        await act(async () => {
          fireEvent.focus(button);
        });
        expect(await screen.findByText(scenario.expectedMessage)).toBeInTheDocument();
      });
    });
  });
});

const TestPanelComponent = () => <div>Plugin Panel to Render</div>;
