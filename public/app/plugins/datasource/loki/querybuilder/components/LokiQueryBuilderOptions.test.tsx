import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { createLokiDatasource } from '../../mocks';
import { LokiQuery, LokiQueryType } from '../../types';

import { LokiQueryBuilderOptions } from './LokiQueryBuilderOptions';

describe('LokiQueryBuilderOptions', () => {
  it('Can change query type', async () => {
    const { props } = setup();

    await userEvent.click(screen.getByTitle('Click to edit options'));
    expect(screen.getByLabelText('Range')).toBeChecked();

    await userEvent.click(screen.getByLabelText('Instant'));

    expect(props.onChange).toHaveBeenCalledWith({
      ...props.query,
      queryType: LokiQueryType.Instant,
    });
  });

  it('Can change legend format', async () => {
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
    datasource: createLokiDatasource(),
    queryStats: { streams: 0, chunks: 0, bytes: 0, entries: 0 },
  };

  const { container } = render(<LokiQueryBuilderOptions {...props} />);
  return { container, props };
}
