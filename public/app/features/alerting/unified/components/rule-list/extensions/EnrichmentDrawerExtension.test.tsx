import { ComponentType } from 'react';
import { render, screen } from 'test/test-utils';

import {
  EnrichmentDrawerExtension,
  EnrichmentDrawerExtensionProps,
  addEnrichmentDrawerExtension,
} from './EnrichmentDrawerExtension';

// Mock component for testing
const MockEnrichmentDrawer: ComponentType<EnrichmentDrawerExtensionProps> = ({ ruleUid, onClose }) => (
  <div data-testid="enrichment-drawer">
    <div data-testid="rule-uid">{ruleUid}</div>
    <button data-testid="close-button" onClick={onClose}>
      Close
    </button>
  </div>
);

describe('EnrichmentDrawerExtension', () => {
  const mockOnClose = jest.fn();
  const defaultProps = {
    ruleUid: 'test-rule-uid',
    onClose: mockOnClose,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render nothing when no extension is registered', () => {
    render(<EnrichmentDrawerExtension {...defaultProps} />);

    expect(screen.queryByTestId('enrichment-drawer')).not.toBeInTheDocument();
  });

  it('should render registered extension with correct props', () => {
    addEnrichmentDrawerExtension(MockEnrichmentDrawer);

    render(<EnrichmentDrawerExtension {...defaultProps} />);

    expect(screen.getByTestId('enrichment-drawer')).toBeInTheDocument();
    expect(screen.getByTestId('rule-uid')).toHaveTextContent('test-rule-uid');
  });

  it('should call onClose when close button is clicked', () => {
    addEnrichmentDrawerExtension(MockEnrichmentDrawer);

    render(<EnrichmentDrawerExtension {...defaultProps} />);

    const closeButton = screen.getByTestId('close-button');
    closeButton.click();

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should handle different rule UIDs', () => {
    addEnrichmentDrawerExtension(MockEnrichmentDrawer);

    const differentRuleUid = 'different-rule-uid';
    render(<EnrichmentDrawerExtension {...defaultProps} ruleUid={differentRuleUid} />);

    expect(screen.getByTestId('rule-uid')).toHaveTextContent(differentRuleUid);
  });

  it('should re-render when ruleUid prop changes', () => {
    addEnrichmentDrawerExtension(MockEnrichmentDrawer);

    const { rerender } = render(<EnrichmentDrawerExtension {...defaultProps} ruleUid="rule-1" />);

    expect(screen.getByTestId('rule-uid')).toHaveTextContent('rule-1');

    rerender(<EnrichmentDrawerExtension {...defaultProps} ruleUid="rule-2" />);

    expect(screen.getByTestId('rule-uid')).toHaveTextContent('rule-2');
  });

  it('should handle error boundary when extension throws', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const FailingComponent: ComponentType<EnrichmentDrawerExtensionProps> = () => {
      throw new Error('Test error');
    };

    addEnrichmentDrawerExtension(FailingComponent);

    // Should not throw, error boundary should catch it
    expect(() => {
      render(<EnrichmentDrawerExtension {...defaultProps} />);
    }).not.toThrow();

    // Error boundary should render fallback UI
    expect(screen.getByText(/Enrichment Drawer Extension failed to load/i)).toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});
