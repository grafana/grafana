import { screen } from '@testing-library/react';

import { selectors } from '@grafana/e2e-selectors';

import { render } from '../../../../test/test-utils';

import { EntityNotFound } from './EntityNotFound';

describe('EntityNotFound', () => {
  it('should render with default "Page" entity', () => {
    render(<EntityNotFound />);
    expect(screen.getByText(/page not found/i)).toBeInTheDocument();
  });

  it('should render with a custom entity name', () => {
    render(<EntityNotFound entity="Dashboard" />);
    expect(screen.getByText(/dashboard not found/i)).toBeInTheDocument();
  });

  it('should render the container with the correct test id', () => {
    render(<EntityNotFound />);
    expect(screen.getByTestId(selectors.components.EntityNotFound.container)).toBeInTheDocument();
  });

  it('should render a link back to home', () => {
    render(<EntityNotFound />);
    const homeLink = screen.getByRole('link', { name: /back to home/i });
    expect(homeLink).toBeInTheDocument();
    expect(homeLink).toHaveAttribute('href', '/');
  });

  it('should render a link to community help', () => {
    render(<EntityNotFound />);
    const communityLink = screen.getByRole('link', { name: /community help/i });
    expect(communityLink).toBeInTheDocument();
    expect(communityLink).toHaveAttribute('href', 'https://community.grafana.com');
  });
});
