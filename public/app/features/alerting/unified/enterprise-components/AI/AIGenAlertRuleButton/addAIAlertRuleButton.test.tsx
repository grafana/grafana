import { render, screen } from '@testing-library/react';
import { type ComponentType } from 'react';

import { AIAlertRuleButtonComponent, type AIAlertRuleButtonProps, addAIAlertRuleButton } from './addAIAlertRuleButton';

const ThrowingComponent: ComponentType<AIAlertRuleButtonProps> = () => {
  throw new Error('Test error from AI component');
};

const WorkingComponent: ComponentType<AIAlertRuleButtonProps> = () => {
  return <div>Generate with AI</div>;
};

describe('AIAlertRuleButtonComponent Error Boundary', () => {
  beforeEach(() => {
    addAIAlertRuleButton(null);
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders null when no component is registered', () => {
    const { container } = render(<AIAlertRuleButtonComponent />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the registered component when it works correctly', () => {
    addAIAlertRuleButton(WorkingComponent);
    render(<AIAlertRuleButtonComponent />);
    expect(screen.getByText('Generate with AI')).toBeInTheDocument();
  });

  it('gracefully handles errors from AI components with error boundary', () => {
    addAIAlertRuleButton(ThrowingComponent);
    render(<AIAlertRuleButtonComponent />);
    expect(screen.getByText('AI Generate Alert Rule button failed to load')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
