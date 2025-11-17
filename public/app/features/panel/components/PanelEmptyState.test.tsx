import { render, screen } from '@testing-library/react';

import { Trans } from '@grafana/i18n';

import { PanelEmptyState } from './PanelEmptyState';

describe('PanelEmptyState', () => {
  it('should render default empty state content', () => {
    render(<PanelEmptyState />);

    expect(
      screen.getByText('Run a query to visualize it here or go to all visualizations to add other panel types')
    ).toBeInTheDocument();
  });

  it('should render custom string content', () => {
    const content = 'Custom empty state message';
    render(<PanelEmptyState content={content} />);

    expect(screen.getByText('Custom empty state message')).toBeInTheDocument();
    expect(
      screen.queryByText('Run a query to visualize it here or go to all visualizations to add other panel types')
    ).not.toBeInTheDocument();
  });

  it('should render Trans component content', () => {
    const content = <Trans i18nKey="">Custom translated message</Trans>;
    render(<PanelEmptyState content={content} />);

    expect(screen.getByText('Custom translated message')).toBeInTheDocument();
    expect(
      screen.queryByText('Run a query to visualize it here or go to all visualizations to add other panel types')
    ).not.toBeInTheDocument();
  });
});
