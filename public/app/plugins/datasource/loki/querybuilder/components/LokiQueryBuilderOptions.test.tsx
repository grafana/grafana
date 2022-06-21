import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { LokiQuery, LokiQueryType } from '../../types';

import { LokiQueryBuilderOptions } from './LokiQueryBuilderOptions';

describe('LokiQueryBuilderOptions', () => {
  it('Can change query type', async () => {
    const { props } = setup();

    screen.getByTitle('Click to edit options').click();
    expect(screen.getByLabelText('Range')).toBeChecked();

    screen.getByLabelText('Instant').click();

    expect(props.onChange).toHaveBeenCalledWith({
      ...props.query,
      queryType: LokiQueryType.Instant,
    });
  });

  it('Can change legend format', async () => {
    const { props } = setup();

    screen.getByTitle('Click to edit options').click();

    const element = screen.getByLabelText('Legend');
    await userEvent.type(element, 'asd');
    fireEvent.keyDown(element, { key: 'Enter', code: 'Enter', charCode: 13 });

    expect(props.onChange).toHaveBeenCalledWith({
      ...props.query,
      legendFormat: 'asd',
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
  };

  const { container } = render(<LokiQueryBuilderOptions {...props} />);
  return { container, props };
}
