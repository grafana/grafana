import { render, screen } from '@testing-library/react';
import React from 'react';
import { openMenu, select } from 'react-select-event';

import { createMockQuery } from '../__mocks__/cloudMonitoringQuery';
import { QueryType } from '../types/query';

import { QueryHeader } from './QueryHeader';

describe('QueryHeader', () => {
  it('can change query types to SLO', async () => {
    const query = createMockQuery();
    const onChange = jest.fn();
    const onRunQuery = jest.fn();

    render(<QueryHeader query={query} onChange={onChange} onRunQuery={onRunQuery} />);

    const queryType = screen.getByLabelText(/Query type/);
    await openMenu(queryType);
    await select(screen.getByLabelText('Select options menu'), 'Service Level Objectives (SLO)');
    expect(onChange).toBeCalledWith(expect.objectContaining({ queryType: QueryType.SLO }));
  });

  it('can change query types to MQL', async () => {
    const query = createMockQuery();
    const onChange = jest.fn();
    const onRunQuery = jest.fn();

    render(<QueryHeader query={query} onChange={onChange} onRunQuery={onRunQuery} />);

    const queryType = screen.getByLabelText(/Query type/);
    await openMenu(queryType);
    await select(screen.getByLabelText('Select options menu'), 'MQL');
    expect(onChange).toBeCalledWith(expect.objectContaining({ queryType: QueryType.TIME_SERIES_QUERY }));
  });
});
