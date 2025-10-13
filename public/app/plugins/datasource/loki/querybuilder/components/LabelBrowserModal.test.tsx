import { render, screen, waitFor } from '@testing-library/react';

import { createLokiDatasource } from '../../__mocks__/datasource';
import { LokiDatasource } from '../../datasource';
import { LokiQuery } from '../../types';

import { LabelBrowserModal, Props } from './LabelBrowserModal';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

describe('LabelBrowserModal', () => {
  let datasource: LokiDatasource, props: Props;

  beforeEach(() => {
    datasource = createLokiDatasource();

    props = {
      isOpen: true,
      datasource: datasource,
      query: {} as LokiQuery,
      onClose: jest.fn(),
      onChange: jest.fn(),
      onRunQuery: jest.fn(),
    };

    jest.spyOn(datasource, 'metadataRequest').mockResolvedValue({});
  });

  it('renders the label browser modal when open', async () => {
    render(<LabelBrowserModal {...props} />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: /label browser/i })).toBeInTheDocument();
  });

  it("doesn't render the label browser modal when closed", async () => {
    render(<LabelBrowserModal {...props} isOpen={false} />);

    expect(screen.queryByRole('heading', { name: /label browser/i })).not.toBeInTheDocument();
  });
});
