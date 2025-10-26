import { render, screen } from '@testing-library/react';
import { ComponentType } from 'react';

import { AIAlertRuleButtonComponent, GenAIAlertRuleButtonProps, addAIAlertRuleButton } from './addAIAlertRuleButton';

// Component that throws an error for testing
const ThrowingComponent: ComponentType<GenAIAlertRuleButtonProps> = () => {
  throw new Error('Test error from AI component');
};

// Component that renders normally
const WorkingComponent: ComponentType<GenAIAlertRuleButtonProps> = () => {
  return <div>AI Alert Rule Button</div>;
};

describe('AIAlertRuleButtonComponent Error Boundary', () => {
  beforeEach(() => {
    addAIAlertRuleButton(null);
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should render null when no component is registered', () => {
    const { container } = render(<AIAlertRuleButtonComponent />);
    expect(container).toBeEmptyDOMElement();
  });

  it('should render the registered component when it works correctly', () => {
    addAIAlertRuleButton(WorkingComponent);
    render(<AIAlertRuleButtonComponent />);
    expect(screen.getByText('AI Alert Rule Button')).toBeInTheDocument();
  });

  it('should gracefully handle errors from AI components with error boundary', () => {
    addAIAlertRuleButton(ThrowingComponent);

    // Render the component, it should not crash the page
    render(<AIAlertRuleButtonComponent />);

    expect(screen.getByText('AI Alert Rule Button failed to load')).toBeInTheDocument();
    // Check for error alert role instead of direct DOM access
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
