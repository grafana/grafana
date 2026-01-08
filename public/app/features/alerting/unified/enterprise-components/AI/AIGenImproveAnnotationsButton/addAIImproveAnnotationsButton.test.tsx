import { render, screen } from '@testing-library/react';
import { ComponentType } from 'react';

import {
  AIImproveAnnotationsButtonComponent,
  GenAIImproveAnnotationsButtonProps,
  addAIImproveAnnotationsButton,
} from './addAIImproveAnnotationsButton';

// Component that throws an error for testing
const ThrowingComponent: ComponentType<GenAIImproveAnnotationsButtonProps> = () => {
  throw new Error('Test error from AI component');
};

// Component that renders normally
const WorkingComponent: ComponentType<GenAIImproveAnnotationsButtonProps> = () => {
  return <div>AI Improve Annotations Button</div>;
};

describe('AIImproveAnnotationsButtonComponent Error Boundary', () => {
  beforeEach(() => {
    addAIImproveAnnotationsButton(null);
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should render null when no component is registered', () => {
    const { container } = render(<AIImproveAnnotationsButtonComponent />);
    expect(container).toBeEmptyDOMElement();
  });

  it('should render the registered component when it works correctly', () => {
    addAIImproveAnnotationsButton(WorkingComponent);
    render(<AIImproveAnnotationsButtonComponent />);
    expect(screen.getByText('AI Improve Annotations Button')).toBeInTheDocument();
  });

  it('should gracefully handle errors from AI components with error boundary', () => {
    addAIImproveAnnotationsButton(ThrowingComponent);

    // Render the component, it should not crash the page
    render(<AIImproveAnnotationsButtonComponent />);

    expect(screen.getByText('AI Improve Annotations Button failed to load')).toBeInTheDocument();
    // Check for error alert role instead of direct DOM access
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
