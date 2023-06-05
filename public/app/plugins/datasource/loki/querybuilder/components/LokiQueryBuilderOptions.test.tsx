import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { LokiQuery, LokiQueryType } from '../../types';

import { LokiQueryBuilderOptions } from './LokiQueryBuilderOptions';

describe('LokiQueryBuilderOptions', () => {
  it('can change query type', async () => {
    const { props } = setup();

    await userEvent.click(screen.getByTitle('Click to edit options'));
    expect(screen.getByLabelText('Range')).toBeChecked();

    await userEvent.click(screen.getByLabelText('Instant'));

    expect(props.onChange).toHaveBeenCalledWith({
      ...props.query,
      queryType: LokiQueryType.Instant,
    });
  });

  it('can change legend format', async () => {
    const { props } = setup();

    await userEvent.click(screen.getByTitle('Click to edit options'));

    const element = screen.getByLabelText('Legend');
    await userEvent.type(element, 'asd');
    await userEvent.keyboard('{enter}');

    expect(props.onChange).toHaveBeenCalledWith({
      ...props.query,
      legendFormat: 'asd',
    });
  });

  it('can change line limit to valid value', async () => {
    const { props } = setup();
    props.query.expr = '{foo="bar"}';

    await userEvent.click(screen.getByTitle('Click to edit options'));

    const element = screen.getByLabelText('Line limit');
    await userEvent.type(element, '10');
    await userEvent.keyboard('{enter}');

    expect(props.onChange).toHaveBeenCalledWith({
      ...props.query,
      maxLines: 10,
    });
  });

  it('does not change line limit to invalid numeric value', async () => {
    const { props } = setup();
    // We need to start with some value to be able to change it
    props.query.maxLines = 10;
    props.query.expr = '{foo="bar"}';

    await userEvent.click(screen.getByTitle('Click to edit options'));

    const element = screen.getByLabelText('Line limit');
    await userEvent.type(element, '-10');
    await userEvent.keyboard('{enter}');

    expect(props.onChange).toHaveBeenCalledWith({
      ...props.query,
      maxLines: undefined,
    });
  });

  it('does not change line limit to invalid text value', async () => {
    const { props } = setup();
    // We need to start with some value to be able to change it
    props.query.maxLines = 10;
    props.query.expr = '{foo="bar"}';

    await userEvent.click(screen.getByTitle('Click to edit options'));

    const element = screen.getByLabelText('Line limit');
    await userEvent.type(element, 'asd');
    await userEvent.keyboard('{enter}');

    expect(props.onChange).toHaveBeenCalledWith({
      ...props.query,
      maxLines: undefined,
    });
  });
});

function setup(queryOverrides: Partial<LokiQuery> = {}) {
  const props = {
    query: {
      refId: 'A',
      expr: '',
      ...queryOverrides,
    },
    onRunQuery: jest.fn(),
    onChange: jest.fn(),
    maxLines: 20,
    queryStats: { streams: 0, chunks: 0, bytes: 0, entries: 0 },
  };

  const { container } = render(<LokiQueryBuilderOptions {...props} />);
  return { container, props };
}
