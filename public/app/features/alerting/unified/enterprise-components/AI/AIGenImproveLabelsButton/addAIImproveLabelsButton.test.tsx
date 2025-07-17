import { render, screen } from '@testing-library/react';
import { ComponentType } from 'react';

import {
  AIImproveLabelsButtonComponent,
  GenAIImproveLabelsButtonProps,
  addAIImproveLabelsButton,
} from './addAIImproveLabelsButton';

// Component that throws an error for testing
const ThrowingComponent: ComponentType<GenAIImproveLabelsButtonProps> = () => {
  throw new Error('Test error from AI component');
};

// Component that renders normally
const WorkingComponent: ComponentType<GenAIImproveLabelsButtonProps> = () => {
  return <div>AI Improve Labels Button</div>;
};

describe('AIImproveLabelsButtonComponent Error Boundary', () => {
  beforeEach(() => {
    addAIImproveLabelsButton(null);
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should render null when no component is registered', () => {
    const { container } = render(<AIImproveLabelsButtonComponent />);
    expect(container).toBeEmptyDOMElement();
  });

  it('should render the registered component when it works correctly', () => {
    addAIImproveLabelsButton(WorkingComponent);
    render(<AIImproveLabelsButtonComponent />);
    expect(screen.getByText('AI Improve Labels Button')).toBeInTheDocument();
  });

  it('should gracefully handle errors from AI components with error boundary', () => {
    addAIImproveLabelsButton(ThrowingComponent);

    // Render the component, it should not crash the page
    render(<AIImproveLabelsButtonComponent />);

    expect(screen.getByText('AI Improve Labels Button failed to load')).toBeInTheDocument();
    // Check for error alert role instead of direct DOM access
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
