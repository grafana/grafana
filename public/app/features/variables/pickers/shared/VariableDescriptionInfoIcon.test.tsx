import { render, screen } from '@testing-library/react';

import { VariableDescriptionInfoIcon, getSafeDocsUrl } from './VariableDescriptionInfoIcon';

describe('VariableDescriptionInfoIcon', () => {
  it('renders a secure external link when docsUrl is safe', () => {
    render(
      <VariableDescriptionInfoIcon description="Helpful context" docsUrl="https://grafana.com/docs" label="env" />
    );

    const link = screen.getByTestId('variable-description-docs-link');
    expect(link).toHaveAttribute('href', 'https://grafana.com/docs');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders a non-clickable icon when docsUrl is missing', () => {
    render(<VariableDescriptionInfoIcon description="Helpful context" />);

    expect(screen.queryByTestId('variable-description-docs-link')).not.toBeInTheDocument();
    expect(screen.getByTestId('variable-description-info-icon')).toBeInTheDocument();
  });

  it('renders a non-clickable icon when description exists but docsUrl is an empty string', () => {
    render(<VariableDescriptionInfoIcon description="Helpful context" docsUrl="" />);

    expect(screen.queryByTestId('variable-description-docs-link')).not.toBeInTheDocument();
    expect(screen.getByTestId('variable-description-info-icon')).toBeInTheDocument();
  });

  it('does not render a clickable link for unsafe docsUrl values', () => {
    render(<VariableDescriptionInfoIcon description="Helpful context" docsUrl="javascript:alert(1)" />);

    expect(screen.queryByTestId('variable-description-docs-link')).not.toBeInTheDocument();
    expect(screen.getByTestId('variable-description-info-icon')).toBeInTheDocument();
  });
});

describe('getSafeDocsUrl', () => {
  it('returns undefined for unsafe URLs', () => {
    expect(getSafeDocsUrl('javascript:alert(1)')).toBeUndefined();
  });

  it('returns the sanitized URL for safe URLs', () => {
    expect(getSafeDocsUrl('https://grafana.com/docs')).toBe('https://grafana.com/docs');
  });
});
