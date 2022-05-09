import { render, screen } from '@testing-library/react';
import React from 'react';

import { createMockDatasource } from '../__mocks__/datasource';
import { createMockQuery } from '../__mocks__/query';

import { AnnotationQueryEditor } from './AnnotationQueryEditor';

describe('AnnotationQueryEditor', () => {
  it('renders', async () => {
    const onChange = jest.fn();
    const onRunQuery = jest.fn();
    const datasource = createMockDatasource();
    const query = createMockQuery();
    render(<AnnotationQueryEditor onChange={onChange} onRunQuery={onRunQuery} query={query} datasource={datasource} />);

    expect(await screen.findByLabelText('Project')).toBeInTheDocument();
    expect(await screen.findByLabelText('Service')).toBeInTheDocument();
    expect(await screen.findByLabelText('Metric name')).toBeInTheDocument();
    expect(await screen.findByLabelText('Group by')).toBeInTheDocument();
    expect(await screen.findByLabelText('Group by function')).toBeInTheDocument();
    expect(await screen.findByLabelText('Alignment function')).toBeInTheDocument();
    expect(await screen.findByLabelText('Alignment period')).toBeInTheDocument();
    expect(await screen.findByLabelText('Alias by')).toBeInTheDocument();
    expect(await screen.findByLabelText('Title')).toBeInTheDocument();
    expect(await screen.findByLabelText('Text')).toBeInTheDocument();
    expect(await screen.findByText('Annotation Query Format')).toBeInTheDocument();
  });
});
