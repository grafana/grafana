import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LokiQuery, LokiQueryType } from '../../types';

import { LokiQueryBuilderOptions } from './LokiQueryBuilderOptions';

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
    setup({ expr: '{foo="bar"}' });
    expect(screen.getByText('Line limit: 20')).toBeInTheDocument();
    expect(screen.getByText('Type: Range')).toBeInTheDocument();
    expect(screen.getByText('Direction: Backward')).toBeInTheDocument();
    expect(screen.queryByText(/step/i)).not.toBeInTheDocument();
  });

  it('shows correct options for metric query', async () => {
    setup({ expr: 'rate({foo="bar"}[5m]', step: '1m', resolution: 2 });
    expect(screen.queryByText('Line limit: 20')).not.toBeInTheDocument();
    expect(screen.getByText('Type: Range')).toBeInTheDocument();
    expect(screen.getByText('Step: 1m')).toBeInTheDocument();
    expect(screen.getByText('Resolution: 1/2')).toBeInTheDocument();
    expect(screen.queryByText(/Direction/)).not.toBeInTheDocument();
  });

  it('does not show resolution field if resolution is not set', async () => {
    setup({ expr: 'rate({foo="bar"}[5m]' });
    await userEvent.click(screen.getByRole('button', { name: /Options/ }));
    expect(screen.queryByText('Resolution')).not.toBeInTheDocument();
  });

  it('does not show resolution field if resolution is set to default value 1', async () => {
    setup({ expr: 'rate({foo="bar"}[5m]', resolution: 1 });
    await userEvent.click(screen.getByRole('button', { name: /Options/ }));
    expect(screen.queryByText('Resolution')).not.toBeInTheDocument();
  });

  it('does shows resolution field with warning if resolution is set to non-default value', async () => {
    setup({ expr: 'rate({foo="bar"}[5m]', resolution: 2 });
    await userEvent.click(screen.getByRole('button', { name: /Options/ }));
    expect(screen.getByText('Resolution')).toBeInTheDocument();
    expect(
      screen.getByText("The 'Resolution' is deprecated. Use 'Step' editor instead to change step parameter.")
    ).toBeInTheDocument();
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
});

function setup(queryOverrides: Partial<LokiQuery> = {}, onChange = jest.fn()) {
  const props = {
    query: {
      refId: 'A',
      expr: '',
      ...queryOverrides,
    },
    onRunQuery: jest.fn(),
    onChange,
    maxLines: 20,
    queryStats: { streams: 0, chunks: 0, bytes: 0, entries: 0 },
  };

  const { container } = render(<LokiQueryBuilderOptions {...props} />);
  return { container, props };
}
