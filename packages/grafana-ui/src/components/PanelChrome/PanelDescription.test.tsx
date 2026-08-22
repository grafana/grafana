import { render, screen } from '@testing-library/react';

import { PanelDescription } from './PanelDescription';

describe('PanelDescription', () => {
  it('exposes an accessible button name for the info control', () => {
    render(<PanelDescription description="Panel help text" title="CPU usage" />);

    expect(screen.getByRole('button', { name: 'More information about CPU usage' })).toBeInTheDocument();
  });

  it('falls back to a generic accessible name when title is missing', () => {
    render(<PanelDescription description="Panel help text" />);

    expect(screen.getByRole('button', { name: 'More information' })).toBeInTheDocument();
  });

  it('renders nothing when description is empty', () => {
    const { container } = render(<PanelDescription description="" title="CPU usage" />);

    expect(container).toBeEmptyDOMElement();
  });
});
