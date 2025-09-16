import { render, screen } from '@testing-library/react';
import { ComponentType } from 'react';

import { AITemplateButtonComponent, GenAITemplateButtonProps, addAITemplateButton } from './addAITemplateButton';

// Component that throws an error for testing
const ThrowingComponent: ComponentType<GenAITemplateButtonProps> = () => {
  throw new Error('Test error from AI component');
};

// Component that renders normally
const WorkingComponent: ComponentType<GenAITemplateButtonProps> = () => {
  return <div>AI Template Button</div>;
};

const mockProps: GenAITemplateButtonProps = {
  onTemplateGenerated: jest.fn(),
  disabled: false,
};

describe('AITemplateButtonComponent Error Boundary', () => {
  beforeEach(() => {
    addAITemplateButton(null);
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should render null when no component is registered', () => {
    const { container } = render(<AITemplateButtonComponent {...mockProps} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('should render the registered component when it works correctly', () => {
    addAITemplateButton(WorkingComponent);
    render(<AITemplateButtonComponent {...mockProps} />);
    expect(screen.getByText('AI Template Button')).toBeInTheDocument();
  });

  it('should gracefully handle errors from AI components with error boundary', () => {
    addAITemplateButton(ThrowingComponent);

    // Render the component, it should not crash the page
    render(<AITemplateButtonComponent {...mockProps} />);

    expect(screen.getByText('AI Template Button failed to load')).toBeInTheDocument();
    // Check for error alert role instead of direct DOM access
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
