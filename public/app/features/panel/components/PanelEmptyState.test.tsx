import { render, screen } from '@testing-library/react';

import { Trans } from '@grafana/i18n';

import { PanelEmptyState } from './PanelEmptyState';

const defaultContent = 'Run a query to visualize it here or go to all visualizations to add other panel types';

describe('PanelEmptyState', () => {
  it('should render default empty state content', () => {
    render(<PanelEmptyState />);

    expect(screen.getByText(defaultContent)).toBeInTheDocument();
  });

  it('should render custom string content', () => {
    const content = 'Custom empty state message';
    render(<PanelEmptyState content={content} />);

    expect(screen.getByText('Custom empty state message')).toBeInTheDocument();
    expect(screen.queryByText(defaultContent)).not.toBeInTheDocument();
  });

  it('should render Trans component content', () => {
    const content = <Trans i18nKey="">Custom translated message</Trans>;
    render(<PanelEmptyState content={content} />);

    expect(screen.getByText('Custom translated message')).toBeInTheDocument();
    expect(screen.queryByText(defaultContent)).not.toBeInTheDocument();
  });
});
