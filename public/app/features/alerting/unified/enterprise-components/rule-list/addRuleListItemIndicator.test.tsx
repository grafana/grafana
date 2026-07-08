import { render, screen } from '@testing-library/react';
import { type ComponentType } from 'react';

import { mockGrafanaPromAlertingRule } from '../../mocks';

import {
  RuleListItemIndicatorComponent,
  type RuleListItemIndicatorProps,
  addRuleListItemIndicator,
} from './addRuleListItemIndicator';

const rule = mockGrafanaPromAlertingRule();

// Component that throws an error for testing
const ThrowingComponent: ComponentType<RuleListItemIndicatorProps> = () => {
  throw new Error('Test error from indicator component');
};

// Component that renders normally
const WorkingComponent: ComponentType<RuleListItemIndicatorProps> = ({ rule }) => {
  return <div>Indicator for {rule.name}</div>;
};

describe('RuleListItemIndicatorComponent Error Boundary', () => {
  beforeEach(() => {
    addRuleListItemIndicator(null);
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should render null when no component is registered', () => {
    const { container } = render(<RuleListItemIndicatorComponent rule={rule} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('should render the registered component when it works correctly', () => {
    addRuleListItemIndicator(WorkingComponent);
    render(<RuleListItemIndicatorComponent rule={rule} />);
    expect(screen.getByText(`Indicator for ${rule.name}`)).toBeInTheDocument();
  });

  it('should gracefully handle errors from registered components with error boundary', () => {
    addRuleListItemIndicator(ThrowingComponent);

    // Render the component, it should not crash the page
    render(<RuleListItemIndicatorComponent rule={rule} />);

    expect(screen.getByText('Rule list item indicator failed to load')).toBeInTheDocument();
    // Check for error alert role instead of direct DOM access
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
