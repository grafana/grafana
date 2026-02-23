import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createMockDatasource } from '../mocks/cloudMonitoringDatasource';
import { createMockQuery } from '../mocks/cloudMonitoringQuery';

import { AnnotationQueryEditor } from './AnnotationQueryEditor';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({
    replace: (val: string) => val,
  }),
}));

describe('AnnotationQueryEditor', () => {
  it('renders correctly', async () => {
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

  it('can set the title', async () => {
    const onChange = jest.fn();
    const onRunQuery = jest.fn();
    const datasource = createMockDatasource();
    const query = createMockQuery();
    render(<AnnotationQueryEditor onChange={onChange} onRunQuery={onRunQuery} query={query} datasource={datasource} />);

    const title = 'user-title';
    await userEvent.type(screen.getByLabelText('Title'), title);
    expect(await screen.findByDisplayValue(title)).toBeInTheDocument();
  });

  it('can set the text', async () => {
    const onChange = jest.fn();
    const onRunQuery = jest.fn();
    const datasource = createMockDatasource();
    const query = createMockQuery();
    render(<AnnotationQueryEditor onChange={onChange} onRunQuery={onRunQuery} query={query} datasource={datasource} />);

    const text = 'user-text';
    await userEvent.type(screen.getByLabelText('Text'), text);
    expect(await screen.findByDisplayValue(text)).toBeInTheDocument();
  });
});
