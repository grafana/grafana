import { render, screen } from '@testing-library/react';
import { ComponentType } from 'react';

import { dateTime } from '@grafana/data';

import { AITriageButtonComponent, GenAITriageButtonProps, addAITriageButton } from './addAITriageButton';

// Component that throws an error for testing
const ThrowingComponent: ComponentType<GenAITriageButtonProps> = () => {
  throw new Error('Test error from AI component');
};

// Component that renders normally
const WorkingComponent: ComponentType<GenAITriageButtonProps> = () => {
  return <div>AI Triage Button</div>;
};

const mockProps: GenAITriageButtonProps = {
  logRecords: [],
  timeRange: {
    from: dateTime(1681300292392),
    to: dateTime(1681300293392),
    raw: {
      from: 'now-1s',
      to: 'now',
    },
  },
};

describe('AITriageButtonComponent Error Boundary', () => {
  beforeEach(() => {
    addAITriageButton(null);
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should render null when no component is registered', () => {
    const { container } = render(<AITriageButtonComponent {...mockProps} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('should render the registered component when it works correctly', () => {
    addAITriageButton(WorkingComponent);
    render(<AITriageButtonComponent {...mockProps} />);
    expect(screen.getByText('AI Triage Button')).toBeInTheDocument();
  });

  it('should gracefully handle errors from AI components with error boundary', () => {
    addAITriageButton(ThrowingComponent);

    // Render the component, it should not crash the page
    render(<AITriageButtonComponent {...mockProps} />);

    expect(screen.getByText('AI Triage Button failed to load')).toBeInTheDocument();
    // Check for error alert role instead of direct DOM access
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
