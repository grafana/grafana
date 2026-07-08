import { render, screen } from '@testing-library/react';
import { type ComponentType } from 'react';

import {
  AIAnnotationsAssistantComponent,
  type AIAnnotationsAssistantProps,
  addAIAnnotationsAssistant,
} from './addAIAnnotationsAssistant';

// Component that throws an error for testing
const ThrowingComponent: ComponentType<AIAnnotationsAssistantProps> = () => {
  throw new Error('Test error from AI component');
};

// Component that renders normally
const WorkingComponent: ComponentType<AIAnnotationsAssistantProps> = () => {
  return <div>AI Annotations Assistant</div>;
};

describe('AIAnnotationsAssistantComponent Error Boundary', () => {
  beforeEach(() => {
    addAIAnnotationsAssistant(null);
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should render null when no component is registered', () => {
    const { container } = render(<AIAnnotationsAssistantComponent />);
    expect(container).toBeEmptyDOMElement();
  });

  it('should render the registered component when it works correctly', () => {
    addAIAnnotationsAssistant(WorkingComponent);
    render(<AIAnnotationsAssistantComponent />);
    expect(screen.getByText('AI Annotations Assistant')).toBeInTheDocument();
  });

  it('should gracefully handle errors from AI components with error boundary', () => {
    addAIAnnotationsAssistant(ThrowingComponent);

    // Render the component, it should not crash the page
    render(<AIAnnotationsAssistantComponent />);

    expect(screen.getByText('AI Annotations Assistant failed to load')).toBeInTheDocument();
    // Check for error alert role instead of direct DOM access
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
