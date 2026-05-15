import { render, screen } from 'test/test-utils';

import HomePage from './HomePage';

describe('HomePage', () => {
  it('renders the placeholder text', () => {
    render(<HomePage />);
    expect(screen.getByText('Welcome to Grafana.')).toBeInTheDocument();
  });
});
