import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { openMenu, select } from 'react-select-event';

import { createMockQuery, createMockSLOQuery } from '../__mocks__/cloudMonitoringQuery';
import { EditorMode, QueryType } from '../types';

import { QueryHeader } from './QueryHeader';

describe('QueryHeader', () => {
  it('renders an editor mode radio group if query type is a metric query', () => {
    const query = createMockQuery();
    const { metricQuery } = query;
    const sloQuery = createMockSLOQuery();
    const onChange = jest.fn();
    const onRunQuery = jest.fn();

    render(
      <QueryHeader
        query={query}
        metricQuery={metricQuery}
        sloQuery={sloQuery}
        onChange={onChange}
        onRunQuery={onRunQuery}
      />
    );

    expect(screen.getByLabelText(/Query type/)).toBeInTheDocument();
    expect(screen.getByLabelText('Builder')).toBeInTheDocument();
    expect(screen.getByLabelText('MQL')).toBeInTheDocument();
  });

  it('does not render an editor mode radio group if query type is a SLO query', () => {
    const query = createMockQuery({ queryType: QueryType.SLO });
    const { metricQuery } = query;
    const sloQuery = createMockSLOQuery();
    const onChange = jest.fn();
    const onRunQuery = jest.fn();

    render(
      <QueryHeader
        query={query}
        metricQuery={metricQuery}
        sloQuery={sloQuery}
        onChange={onChange}
        onRunQuery={onRunQuery}
      />
    );

    expect(screen.getByLabelText(/Query type/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Builder')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('MQL')).not.toBeInTheDocument();
  });

  it('can change query types', async () => {
    const query = createMockQuery();
    const { metricQuery } = query;
    const sloQuery = createMockSLOQuery();
    const onChange = jest.fn();
    const onRunQuery = jest.fn();

    render(
      <QueryHeader
        query={query}
        metricQuery={metricQuery}
        sloQuery={sloQuery}
        onChange={onChange}
        onRunQuery={onRunQuery}
      />
    );

    const queryType = screen.getByLabelText(/Query type/);
    await openMenu(queryType);
    await select(screen.getByLabelText('Select options menu'), 'Service Level Objectives (SLO)');
    expect(onChange).toBeCalledWith(expect.objectContaining({ queryType: QueryType.SLO }));
  });

  it('can change editor modes when query is a metric query type', async () => {
    const query = createMockQuery();
    const { metricQuery } = query;
    const sloQuery = createMockSLOQuery();
    const onChange = jest.fn();
    const onRunQuery = jest.fn();

    render(
      <QueryHeader
        query={query}
        metricQuery={metricQuery}
        sloQuery={sloQuery}
        onChange={onChange}
        onRunQuery={onRunQuery}
      />
    );

    const builder = screen.getByLabelText('Builder');
    const MQL = screen.getByLabelText('MQL');
    expect(builder).toBeChecked();
    expect(MQL).not.toBeChecked();

    await userEvent.click(MQL);

    expect(onChange).toBeCalledWith(
      expect.objectContaining({ metricQuery: expect.objectContaining({ editorMode: EditorMode.MQL }) })
    );
  });
});
