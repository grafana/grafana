import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CoreApp, LogSortOrderChangeEvent, LogsSortOrder, store } from '@grafana/data';
import { config, getAppEvents } from '@grafana/runtime';

import { createLokiDatasource } from '../../mocks/datasource';
import { LokiQuery, LokiQueryDirection, LokiQueryType } from '../../types';

import { LokiQueryBuilderOptions, Props } from './LokiQueryBuilderOptions';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    featureToggles: {
      ...jest.requireActual('@grafana/runtime').featureToggles,
      lokiShardSplitting: true,
    },
  },
  getAppEvents: jest.fn(),
}));

const subscribeMock = jest.fn();
beforeAll(() => {
  config.featureToggles.lokiShardSplitting = true;
  subscribeMock.mockImplementation(() => ({ unsubscribe: jest.fn() }));
  jest.mocked(getAppEvents).mockReturnValue({
    publish: jest.fn(),
    getStream: jest.fn(),
    subscribe: subscribeMock,
    removeAllListeners: jest.fn(),
    newScopedBus: jest.fn(),
  });
});

describe('LokiQueryBuilderOptions', () => {
  it('can change query type', async () => {
    const { props } = setup();

    await userEvent.click(screen.getByRole('button', { name: /Options/ }));
    expect(screen.getByLabelText('Range')).toBeChecked();

    await userEvent.click(screen.getByLabelText('Instant'));

    expect(props.onChange).toHaveBeenCalledWith({
      ...props.query,
      queryType: LokiQueryType.Instant,
    });
  });

  it('can change legend format', async () => {
    const { props } = setup();

    await userEvent.click(screen.getByRole('button', { name: /Options/ }));

    // First autosize input is a Legend
    const element = screen.getAllByTestId('autosize-input')[0];
    await userEvent.type(element, 'asd');
    await userEvent.keyboard('{enter}');

    expect(props.onChange).toHaveBeenCalledWith({
      ...props.query,
      legendFormat: 'asd',
    });
  });

  it('can change line limit to valid value', async () => {
    const { props } = setup({ expr: '{foo="bar"}' });

    await userEvent.click(screen.getByRole('button', { name: /Options/ }));
    // Second autosize input is a Line limit
    const element = screen.getAllByTestId('autosize-input')[1];
    await userEvent.type(element, '10');
    await userEvent.keyboard('{enter}');

    expect(props.onChange).toHaveBeenCalledWith({
      ...props.query,
      maxLines: 10,
    });
  });

  it('does not change line limit to invalid numeric value', async () => {
    const { props } = setup({ expr: '{foo="bar"}' });
    // We need to start with some value to be able to change it
    props.query.maxLines = 10;

    await userEvent.click(screen.getByRole('button', { name: /Options/ }));
    // Second autosize input is a Line limit
    const element = screen.getAllByTestId('autosize-input')[1];
    await userEvent.type(element, '-10');
    await userEvent.keyboard('{enter}');

    expect(props.onChange).toHaveBeenCalledWith({
      ...props.query,
      maxLines: undefined,
    });
  });

  it('does not change line limit to invalid text value', async () => {
    const { props } = setup({ expr: '{foo="bar"}' });
    // We need to start with some value to be able to change it
    props.query.maxLines = 10;

    await userEvent.click(screen.getByRole('button', { name: /Options/ }));
    // Second autosize input is a Line limit
    const element = screen.getAllByTestId('autosize-input')[1];
    await userEvent.type(element, 'asd');
    await userEvent.keyboard('{enter}');

    expect(props.onChange).toHaveBeenCalledWith({
      ...props.query,
      maxLines: undefined,
    });
  });

  it('shows correct options for log query', async () => {
    setup({ expr: '{foo="bar"}', direction: LokiQueryDirection.Backward });
    expect(screen.getByText('Line limit: 20')).toBeInTheDocument();
    expect(screen.getByText('Type: Range')).toBeInTheDocument();
    expect(screen.getByText('Direction: Backward')).toBeInTheDocument();
    expect(screen.queryByText(/step/i)).not.toBeInTheDocument();
  });

  it('shows correct options for metric query', async () => {
    setup({ expr: 'rate({foo="bar"}[5m]', step: '1m' });
    expect(screen.queryByText('Line limit: 20')).not.toBeInTheDocument();
    expect(screen.getByText('Type: Range')).toBeInTheDocument();
    expect(screen.getByText('Step: 1m')).toBeInTheDocument();
    expect(screen.queryByText(/Direction/)).not.toBeInTheDocument();
  });

  it.each(['abc', 10])('shows correct options for metric query with invalid step', async (step: string | number) => {
    // @ts-expect-error Expected for backward compatibility test
    setup({ expr: 'rate({foo="bar"}[5m]', step });
    expect(screen.queryByText('Line limit: 20')).not.toBeInTheDocument();
    expect(screen.getByText('Type: Range')).toBeInTheDocument();
    expect(screen.getByText('Step: Invalid value')).toBeInTheDocument();
  });

  it('shows error when invalid value in step', async () => {
    setup({ expr: 'rate({foo="bar"}[5m]', step: 'a' });
    await userEvent.click(screen.getByRole('button', { name: /Options/ }));
    expect(screen.getByText(/Invalid step/)).toBeInTheDocument();
  });

  it('does not show error when valid value in step', async () => {
    setup({ expr: 'rate({foo="bar"}[5m]', step: '1m' });
    await userEvent.click(screen.getByRole('button', { name: /Options/ }));
    expect(screen.queryByText(/Invalid step/)).not.toBeInTheDocument();
  });

  it('does not show error when valid millisecond value in step', async () => {
    setup({ expr: 'rate({foo="bar"}[5m]', step: '1ms' });
    await userEvent.click(screen.getByRole('button', { name: /Options/ }));
    expect(screen.queryByText(/Invalid step/)).not.toBeInTheDocument();
  });

  it('does not show error when valid day value in step', async () => {
    setup({ expr: 'rate({foo="bar"}[5m]', step: '1d' });
    await userEvent.click(screen.getByRole('button', { name: /Options/ }));
    expect(screen.queryByText(/Invalid step/)).not.toBeInTheDocument();
  });

  it('does not show instant type when using a log query', async () => {
    setup({ expr: '{foo="bar"}', queryType: LokiQueryType.Instant });
    expect(screen.queryByText(/Instant/)).not.toBeInTheDocument();
  });

  it('does not show instant type in the options when using a log query', async () => {
    setup({ expr: '{foo="bar"}', step: '1m' });
    await userEvent.click(screen.getByRole('button', { name: /Options/ }));
    expect(screen.queryByText(/Instant/)).not.toBeInTheDocument();
  });

  it('allows to clear step input', async () => {
    setup({ expr: 'rate({foo="bar"}[5m]', step: '4s' });
    await userEvent.click(screen.getByRole('button', { name: /Options/ }));
    expect(screen.getByDisplayValue('4s')).toBeInTheDocument();
    await userEvent.clear(screen.getByDisplayValue('4s'));
    expect(screen.queryByDisplayValue('4s')).not.toBeInTheDocument();
  });

  it('should transform non duration numbers to duration', async () => {
    const onChange = jest.fn();
    setup({ expr: 'rate({foo="bar"}[5m]', step: '4' }, onChange);
    await userEvent.click(screen.getByRole('button', { name: /Options/ }));
    expect(onChange).toHaveBeenCalledWith({
      refId: 'A',
      expr: 'rate({foo="bar"}[5m]',
      step: '4s',
    });
  });

  describe('Query direction', () => {
    it("initializes query direction when it's empty in Explore or Dashboards", () => {
      const onChange = jest.fn();
      setup({ expr: '{foo="bar"}' }, onChange, { app: CoreApp.Explore });
      expect(onChange).toHaveBeenCalledWith({
        expr: '{foo="bar"}',
        refId: 'A',
        direction: LokiQueryDirection.Backward,
      });
    });

    it('does not change direction on initialization elsewhere', () => {
      const onChange = jest.fn();
      setup({ expr: '{foo="bar"}' }, onChange, { app: undefined });
      expect(onChange).not.toHaveBeenCalled();
    });

    it('uses backward as default in Explore with no previous stored preference', () => {
      const onChange = jest.fn();
      store.delete('grafana.explore.logs.sortOrder');
      setup({ expr: '{foo="bar"}' }, onChange, { app: CoreApp.Explore });
      expect(onChange).toHaveBeenCalledWith({
        expr: '{foo="bar"}',
        refId: 'A',
        direction: LokiQueryDirection.Backward,
      });
    });

    it('uses the stored sorting option to determine direction in Explore', () => {
      store.set('grafana.explore.logs.sortOrder', LogsSortOrder.Ascending);
      const onChange = jest.fn();
      setup({ expr: '{foo="bar"}' }, onChange, { app: CoreApp.Explore });
      expect(onChange).toHaveBeenCalledWith({
        expr: '{foo="bar"}',
        refId: 'A',
        direction: LokiQueryDirection.Forward,
      });
      store.delete('grafana.explore.logs.sortOrder');
    });

    describe('Event handling', () => {
      let listener: (event: LogSortOrderChangeEvent) => void = jest.fn();
      const onChangeMock = jest.fn();
      beforeEach(() => {
        onChangeMock.mockClear();
        listener = jest.fn();
        subscribeMock.mockImplementation((_: unknown, callback: (event: LogSortOrderChangeEvent) => void) => {
          listener = callback;
          return { unsubscribe: jest.fn() };
        });
      });
      it('subscribes to sort change event and updates the direction', () => {
        setup({ expr: '{foo="bar"}', direction: LokiQueryDirection.Backward }, onChangeMock, {
          app: CoreApp.Dashboard,
        });
        expect(screen.getByText(/Direction: Backward/)).toBeInTheDocument();
        listener(
          new LogSortOrderChangeEvent({
            order: LogsSortOrder.Ascending,
          })
        );
        expect(onChangeMock).toHaveBeenCalledTimes(1);
        expect(onChangeMock).toHaveBeenCalledWith({
          direction: 'forward',
          expr: '{foo="bar"}',
          refId: 'A',
        });
      });

      it('does not change the direction when the current direction is scan', () => {
        setup({ expr: '{foo="bar"}', direction: LokiQueryDirection.Scan }, onChangeMock, { app: CoreApp.Dashboard });
        expect(screen.getByText(/Direction: Scan/)).toBeInTheDocument();
        listener(
          new LogSortOrderChangeEvent({
            order: LogsSortOrder.Ascending,
          })
        );
        expect(onChangeMock).not.toHaveBeenCalled();
      });
    });
  });

  describe('Step validation', () => {
    it('considers empty step as valid', async () => {
      setup({ expr: 'rate({foo="bar"}[5m]' });
      await userEvent.click(screen.getByRole('button', { name: /Options/ }));
      expect(screen.queryByText(/Invalid step/)).not.toBeInTheDocument();
    });

    it('considers variable step that exists in the datasource as valid', async () => {
      const datasource = createLokiDatasource();
      datasource.getVariables = jest.fn().mockReturnValue(['$interval']);
      setup({ expr: 'rate({foo="bar"}[5m]', step: '$interval' }, undefined, { datasource });
      await userEvent.click(screen.getByRole('button', { name: /Options/ }));
      expect(screen.queryByText(/Invalid step/)).not.toBeInTheDocument();
    });

    it('considers variable step that does not exist in the datasource as invalid', async () => {
      const datasource = createLokiDatasource();
      datasource.getVariables = jest.fn().mockReturnValue(['$interval']);
      setup({ expr: 'rate({foo="bar"}[5m]', step: '$custom' }, undefined, { datasource });
      await userEvent.click(screen.getByRole('button', { name: /Options/ }));
      expect(screen.getByText(/Invalid step/)).toBeInTheDocument();
    });

    it('considers valid duration step as valid', async () => {
      setup({ expr: 'rate({foo="bar"}[5m]', step: '1m' });
      await userEvent.click(screen.getByRole('button', { name: /Options/ }));
      expect(screen.queryByText(/Invalid step/)).not.toBeInTheDocument();
    });

    it('considers invalid step as invalid', async () => {
      setup({ expr: 'rate({foo="bar"}[5m]', step: 'invalid' });
      await userEvent.click(screen.getByRole('button', { name: /Options/ }));
      expect(screen.getByText(/Invalid step/)).toBeInTheDocument();
    });

    it('considers non-duration number as invalid', async () => {
      setup({ expr: 'rate({foo="bar"}[5m]', step: '123' });
      await userEvent.click(screen.getByRole('button', { name: /Options/ }));
      expect(screen.getByText(/Invalid step/)).toBeInTheDocument();
    });
  });
});

function setup(queryOverrides: Partial<LokiQuery> = {}, onChange = jest.fn(), propOverrides: Partial<Props> = {}) {
  const datasource = createLokiDatasource();
  datasource.maxLines = 20;

  const props = {
    query: {
      refId: 'A',
      expr: '',
      ...queryOverrides,
    },
    onRunQuery: jest.fn(),
    onChange,
    datasource,
    queryStats: { streams: 0, chunks: 0, bytes: 0, entries: 0 },
    ...propOverrides,
  };

  const { container } = render(<LokiQueryBuilderOptions {...props} />);
  return { container, props };
}
