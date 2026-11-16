import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type Note } from '../liveScenario';

import { NotMeasuredNotice } from './NotMeasuredNotice';

const notes: Note[] = [
  { source: 'metrics', message: 'No traces_span_metrics_calls_total series in the last 30 minutes' },
  { source: 'knowledgegraph', message: 'Showing the first 700 Service entities. The knowledge graph holds more.' },
];

describe('NotMeasuredNotice', () => {
  it('keeps the reasons off the page until the icon is hovered', () => {
    render(<NotMeasuredNotice notes={notes} />);

    expect(screen.getByLabelText('Not measured')).toBeInTheDocument();
    expect(screen.queryByText(/No traces_span_metrics_calls_total/)).not.toBeInTheDocument();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('names each source with its reason in the tooltip on hover', async () => {
    render(<NotMeasuredNotice notes={notes} />);

    await userEvent.hover(screen.getByLabelText('Not measured'));

    const items = within(await screen.findByRole('tooltip')).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'Metrics: No traces_span_metrics_calls_total series in the last 30 minutes',
      'Knowledge graph: Showing the first 700 Service entities. The knowledge graph holds more.',
    ]);
  });

  it('shows no icon when nothing is missing', () => {
    const { container } = render(<NotMeasuredNotice notes={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
