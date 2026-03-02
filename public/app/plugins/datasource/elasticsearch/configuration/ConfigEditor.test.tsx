import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { config } from '@grafana/runtime';

import { ConfigEditor } from './ConfigEditor';
import { createDefaultConfigOptions } from './mocks/configOptions';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    sigV4AuthEnabled: false,
  },
}));

describe('ConfigEditor', () => {
  it('should render without error', () => {
    expect(() =>
      render(<ConfigEditor onOptionsChange={() => {}} options={createDefaultConfigOptions()} />)
    ).not.toThrow();
  });

  it('should render all parts of the config', () => {
    render(<ConfigEditor onOptionsChange={() => {}} options={createDefaultConfigOptions()} />);

    // Check DataSourceHttpSettings are rendered
    expect(screen.getByRole('heading', { name: 'Connection' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Authentication' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Advanced HTTP settings' })).toBeInTheDocument();

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

  describe('Authentication options', () => {
    it('should display API Key auth option', async () => {
      const user = userEvent.setup();
      render(<ConfigEditor onOptionsChange={() => {}} options={createDefaultConfigOptions()} />);

      const authSelect = screen.getByLabelText('Authentication method');
      await user.click(authSelect);

      expect(screen.getByText('API Key')).toBeInTheDocument();
      expect(screen.getByText('API Key authentication')).toBeInTheDocument();
    });

    it('should display SigV4 auth option when feature flag is enabled', async () => {
      const user = userEvent.setup();
      config.sigV4AuthEnabled = true;

      render(<ConfigEditor onOptionsChange={() => {}} options={createDefaultConfigOptions()} />);

      const authSelect = screen.getByLabelText('Authentication method');
      await user.click(authSelect);

      expect(screen.getByText('SigV4 auth')).toBeInTheDocument();
      expect(screen.getByText('AWS Signature Version 4 authentication')).toBeInTheDocument();
      config.sigV4AuthEnabled = false;
    });

    it('should not display SigV4 auth option when feature flag is disabled', async () => {
      const user = userEvent.setup();

      render(<ConfigEditor onOptionsChange={() => {}} options={createDefaultConfigOptions()} />);

      const authSelect = screen.getByLabelText('Authentication method');
      await user.click(authSelect);

      expect(screen.queryByText('SigV4 auth')).not.toBeInTheDocument();
      expect(screen.queryByText('AWS Signature Version 4 authentication')).not.toBeInTheDocument();
    });
  });
});
