import { render, screen } from 'test/test-utils';

import { RuleDescription } from './RuleDescription';

describe('RuleDescription', () => {
  it('shows the last error in error colour when present', () => {
    render(<RuleDescription lastError="remote write failed" />);

    expect(screen.getByText('remote write failed')).toBeInTheDocument();
  });

  it('shows the summary in secondary colour when there is no error', () => {
    render(<RuleDescription summary="CPU usage is high" />);

    expect(screen.getByText('CPU usage is high')).toBeInTheDocument();
  });

  it('shows the error over the summary when both are present', () => {
    render(<RuleDescription lastError="remote write failed" summary="CPU usage is high" />);

    expect(screen.getByText('remote write failed')).toBeInTheDocument();
    expect(screen.queryByText('CPU usage is high')).not.toBeInTheDocument();
  });

  it('shows a tooltip with the full error text', async () => {
    render(<RuleDescription lastError="remote write failed: connection refused" />);

    expect(await screen.findByLabelText('remote write failed: connection refused')).toBeInTheDocument();
  });

  it('shows a tooltip with the full summary text', async () => {
    render(<RuleDescription summary="Alert fires when CPU exceeds threshold" />);

    expect(await screen.findByLabelText('Alert fires when CPU exceeds threshold')).toBeInTheDocument();
  });
});
