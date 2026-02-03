import { render, screen } from '@testing-library/react';

import { RuleGroupContainer } from './components/RuleGroupContainer';

describe('RuleGroupContainer', () => {
  it('should display group name as label', () => {
    render(
      <RuleGroupContainer groupName="MyGroup">
        <div>Rule content</div>
      </RuleGroupContainer>
    );

    expect(screen.getByText('MyGroup')).toBeInTheDocument();
  });

  it('should render as treeitem with correct aria attributes', () => {
    render(
      <RuleGroupContainer groupName="TestGroup">
        <div>Rule content</div>
      </RuleGroupContainer>
    );

    const treeItem = screen.getByRole('treeitem');
    expect(treeItem).toHaveAttribute('aria-selected', 'false');
  });

  it('should render children inside container', () => {
    render(
      <RuleGroupContainer groupName="TestGroup">
        <span data-testid="child-content">Child content</span>
      </RuleGroupContainer>
    );

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });
});
