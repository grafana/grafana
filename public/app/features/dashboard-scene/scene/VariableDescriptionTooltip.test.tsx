import { render, screen } from '@testing-library/react';

import { type Tooltip } from '@grafana/ui';

import { VariableDescriptionTooltip } from './VariableDescriptionTooltip';

function renderTooltipContent(content: React.ComponentProps<typeof Tooltip>['content']): React.ReactNode {
  if (typeof content === 'function') {
    return content({});
  }

  return content;
}

jest.mock('@grafana/ui', () => {
  const actual = jest.requireActual('@grafana/ui');

  return {
    ...actual,
    Tooltip: ({ content, children, interactive, placement }: React.ComponentProps<typeof Tooltip>) => (
      <div data-testid="mock-tooltip" data-interactive={interactive ? 'true' : 'false'} data-placement={placement}>
        <div data-testid="mock-tooltip-content">{renderTooltipContent(content)}</div>
        {children}
      </div>
    ),
  };
});

describe('VariableDescriptionTooltip', () => {
  it('renders markdown links as external links', () => {
    render(<VariableDescriptionTooltip description={'Read [docs](https://grafana.com/docs).'} placement="bottom" />);

    const link = screen.getByRole('link', { name: 'docs' });
    expect(link).toHaveAttribute('href', 'https://grafana.com/docs');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders bare links as external links', () => {
    render(<VariableDescriptionTooltip description={'Details: https://example.com/path?q=1.'} placement="bottom" />);

    const link = screen.getByRole('link', { name: 'https://example.com/path?q=1' });
    expect(link).toHaveAttribute('href', 'https://example.com/path?q=1');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('does not render unsafe links', () => {
    render(<VariableDescriptionTooltip description={'Do not click [this](javascript:alert(1))'} placement="bottom" />);

    expect(screen.queryByRole('link', { name: 'this' })).not.toBeInTheDocument();
    expect(screen.getByText(/this/)).toBeInTheDocument();
  });

  it('uses an interactive tooltip', () => {
    render(<VariableDescriptionTooltip description={'Read [docs](https://grafana.com/docs).'} placement="top" />);

    expect(screen.getByTestId('mock-tooltip')).toHaveAttribute('data-interactive', 'true');
  });
});
