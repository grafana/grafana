import { render, screen } from 'test/test-utils';

import { type StatTone, StatCard } from './StatCard';

describe('StatCard', () => {
  it('renders the label, big value and sub-label', () => {
    render(<StatCard icon="apps" tone="info" big="42%" label="Managed dashboards" subLabel="12 of 30 dashboards" />);

    expect(screen.getByText('Managed dashboards')).toBeInTheDocument();
    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(screen.getByText('12 of 30 dashboards')).toBeInTheDocument();
  });

  it('shows the sub-label only when provided', () => {
    const { rerender } = render(<StatCard icon="apps" tone="info" big="42%" label="Managed" subLabel="detail text" />);
    expect(screen.getByText('detail text')).toBeInTheDocument();

    rerender(<StatCard icon="apps" tone="info" big="42%" label="Managed" />);
    expect(screen.queryByText('detail text')).not.toBeInTheDocument();
  });

  it('renders every tone', () => {
    const tones: StatTone[] = ['neutral', 'success', 'info', 'warning', 'primary'];

    tones.forEach((tone) => {
      const { unmount } = render(<StatCard icon="apps" tone={tone} big="1" label={`label-${tone}`} />);
      expect(screen.getByText(`label-${tone}`)).toBeInTheDocument();
      unmount();
    });
  });
});
