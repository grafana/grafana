import { render, screen } from 'test/test-utils';

import { RuleListErrors } from './RuleListErrors';

describe('RuleListErrors', () => {
  it('shows an error when the rules source list fails to load', () => {
    render(<RuleListErrors rulesSources={{ items: [], isLoading: false, error: new Error('Failed to fetch') }} />);

    expect(screen.getByTestId('cloud-rulessource-errors')).toHaveTextContent(
      'Failed to load data sources: Failed to fetch'
    );
  });

  it('shows no errors when the rules source list loads', () => {
    render(<RuleListErrors rulesSources={{ items: [], isLoading: false }} />);

    expect(screen.queryByTestId('cloud-rulessource-errors')).not.toBeInTheDocument();
  });
});
