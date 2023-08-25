import { render, screen } from '@testing-library/react';
import React from 'react';

import { ConfigEditor } from './ConfigEditor';
import { createDefaultConfigOptions } from './mocks';

describe('ConfigEditor', () => {
  it('should render without error', () => {
    expect(() =>
      render(<ConfigEditor onOptionsChange={() => {}} options={createDefaultConfigOptions()} />)
    ).not.toThrow();
  });

  it('should render all parts of the config', () => {
    render(<ConfigEditor onOptionsChange={() => {}} options={createDefaultConfigOptions()} />);

    // Check DataSourceHttpSettings are rendered
    expect(screen.getByRole('heading', { name: 'HTTP' })).toBeInTheDocument();

    // Check ElasticDetails are rendered
    expect(screen.getByText('Elasticsearch details')).toBeInTheDocument();

    // Check LogsConfig are rendered
    expect(screen.getByText('Logs')).toBeInTheDocument();
  });

  it('should set defaults', () => {
    const mockOnOptionsChange = jest.fn();
    const options = createDefaultConfigOptions();
    // @ts-ignore
    delete options.jsonData.timeField;
    delete options.jsonData.maxConcurrentShardRequests;

    const { rerender } = render(<ConfigEditor onOptionsChange={mockOnOptionsChange} options={options} />);

    expect(mockOnOptionsChange).toHaveBeenCalledWith(
      expect.objectContaining({
        jsonData: expect.objectContaining({
          timeField: '@timestamp',
          maxConcurrentShardRequests: 5,
        }),
      })
    );

    // Setting options to default should happen on every render, not once.
    mockOnOptionsChange.mockClear();
    const updatedOptions = { ...options };
    updatedOptions.jsonData.timeField = '';
    // @ts-expect-error
    updatedOptions.jsonData.maxConcurrentShardRequests = '';
    rerender(<ConfigEditor onOptionsChange={mockOnOptionsChange} options={updatedOptions} />);

    expect(mockOnOptionsChange).toHaveBeenCalledWith(
      expect.objectContaining({
        jsonData: expect.objectContaining({
          timeField: '@timestamp',
          maxConcurrentShardRequests: 5,
        }),
      })
    );
  });

  it('should not apply default if values are set', () => {
    const mockOnOptionsChange = jest.fn();

    render(<ConfigEditor onOptionsChange={mockOnOptionsChange} options={createDefaultConfigOptions()} />);

    expect(mockOnOptionsChange).toHaveBeenCalledTimes(0);
  });
});
