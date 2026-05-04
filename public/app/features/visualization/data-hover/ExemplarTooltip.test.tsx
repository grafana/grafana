import { render, screen } from '@testing-library/react';

import { type Field, type LinkModel } from '@grafana/data';
import { type VizTooltipItem } from '@grafana/ui/internal';

import { ExemplarTooltip } from './ExemplarTooltip';

function makeItems(overrides: Partial<VizTooltipItem>[] = []): VizTooltipItem[] {
  return overrides.map((o) => ({ label: 'label', value: 'value', ...o }));
}

describe('ExemplarTooltip', () => {
  it('renders the "Exemplar" label in the header', () => {
    render(<ExemplarTooltip items={[]} isPinned={false} />);
    expect(screen.getByText('Exemplar')).toBeInTheDocument();
  });

  it('shows the Time item value in the header', () => {
    const items = makeItems([{ label: 'Time', value: '2024-01-01 12:00:00' }]);
    render(<ExemplarTooltip items={items} isPinned={false} />);
    expect(screen.getByText('2024-01-01 12:00:00')).toBeInTheDocument();
  });

  it('uses an empty string in the header when no Time item is present', () => {
    const items = makeItems([{ label: 'traceID', value: 'abc123' }]);
    render(<ExemplarTooltip items={items} isPinned={false} />);
    expect(screen.getByText('Exemplar')).toBeInTheDocument();
  });

  it('renders non-Time items in the content', () => {
    const items = makeItems([
      { label: 'Time', value: '12:00' },
      { label: 'traceID', value: 'abc123' },
      { label: 'duration', value: '42ms' },
    ]);
    render(<ExemplarTooltip items={items} isPinned={false} />);
    expect(screen.getByText('traceID')).toBeInTheDocument();
    expect(screen.getByText('abc123')).toBeInTheDocument();
    expect(screen.getByText('duration')).toBeInTheDocument();
    expect(screen.getByText('42ms')).toBeInTheDocument();
  });

  it('does not render the "Time" label in the content section', () => {
    const items = makeItems([
      { label: 'Time', value: '12:00:00' },
      { label: 'traceID', value: 'abc' },
    ]);
    render(<ExemplarTooltip items={items} isPinned={false} />);
    expect(screen.queryByText('Time')).not.toBeInTheDocument();
    expect(screen.getByText('traceID')).toBeInTheDocument();
  });

  it('renders data links in the footer', () => {
    const links: Array<LinkModel<Field>> = [
      {
        title: 'Open Trace',
        href: 'https://tracing.example.com',
        target: '_blank',
        origin: {} as Field,
        onClick: undefined,
      },
    ];
    render(<ExemplarTooltip items={[]} links={links} isPinned={true} />);
    expect(screen.getByText('Open Trace')).toBeInTheDocument();
  });

  it('renders with no links when links prop is omitted', () => {
    render(<ExemplarTooltip items={makeItems([{ label: 'k', value: 'v' }])} isPinned={false} />);
    expect(screen.getByText('k')).toBeInTheDocument();
  });

  it('passes maxHeight to enable scrolling when provided', () => {
    const items = makeItems([{ label: 'k', value: 'v' }]);
    const { container } = render(<ExemplarTooltip items={items} isPinned={false} maxHeight={200} />);
    expect(container).not.toBeEmptyDOMElement();
  });
});
