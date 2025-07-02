import { render, screen } from '@testing-library/react';
import * as React from 'react';

import { PluginMeta, PluginType, PluginContext } from '@grafana/data';
import { getMockPlugin } from '@grafana/data/test';

import { PluginErrorBoundary } from './PluginErrorBoundary';

const ThrowingComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>Working component</div>;
};

const TestFallback = ({ error, errorInfo }: { error: Error | null; errorInfo: React.ErrorInfo | null }) => (
  <div>
    <div>Fallback rendered</div>
    <div>Error: {error?.message}</div>
    {errorInfo && <div>Error info available</div>}
  </div>
);

const renderWithPluginContext = (
  children: React.ReactNode,
  pluginMeta?: PluginMeta,
  fallback?: React.ComponentType<{ error: Error | null; errorInfo: React.ErrorInfo | null }>,
  onError?: (error: Error, info: React.ErrorInfo) => void
) => {
  const mockPluginMeta = pluginMeta || getMockPlugin({ id: 'test-plugin', type: PluginType.panel });

  return render(
    <PluginContext.Provider value={{ meta: mockPluginMeta }}>
      <PluginErrorBoundary fallback={fallback} onError={onError}>
        {children}
      </PluginErrorBoundary>
    </PluginContext.Provider>
  );
};

describe('PluginErrorBoundary', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('should render children normally when no error occurs', () => {
    renderWithPluginContext(<ThrowingComponent shouldThrow={false} />);

    expect(screen.getByText('Working component')).toBeInTheDocument();
  });

  it('should render null when an error occurs and no fallback is provided', () => {
    const { container } = renderWithPluginContext(<ThrowingComponent shouldThrow={true} />);

    expect(container.firstChild).toBeNull();
  });

  it('should render custom fallback component when an error occurs', () => {
    renderWithPluginContext(<ThrowingComponent shouldThrow={true} />, undefined, TestFallback);

    expect(screen.getByText('Fallback rendered')).toBeInTheDocument();
    expect(screen.getByText('Error: Test error message')).toBeInTheDocument();
    expect(screen.getByText('Error info available')).toBeInTheDocument();
  });

  it('should call onError callback when an error occurs', () => {
    const onErrorMock = jest.fn();

    renderWithPluginContext(<ThrowingComponent shouldThrow={true} />, undefined, undefined, onErrorMock);

    expect(onErrorMock).toHaveBeenCalledTimes(1);
    expect(onErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Test error message' }),
      expect.objectContaining({
        componentStack: expect.any(String),
      })
    );
  });

  it('should log error to console with plugin ID when no onError callback is provided', () => {
    const mockPluginMeta = getMockPlugin({ id: 'my-test-plugin', type: PluginType.datasource });

    renderWithPluginContext(<ThrowingComponent shouldThrow={true} />, mockPluginMeta);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Plugin "my-test-plugin" failed to load:',
      expect.objectContaining({ message: 'Test error message' }),
      expect.objectContaining({
        componentStack: expect.any(String),
      })
    );
  });

  it('should handle error when plugin context is not available', () => {
    render(
      <PluginErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </PluginErrorBoundary>
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Plugin "undefined" failed to load:',
      expect.objectContaining({ message: 'Test error message' }),
      expect.objectContaining({
        componentStack: expect.any(String),
      })
    );
  });

  it('should update state correctly when error occurs', () => {
    renderWithPluginContext(<ThrowingComponent shouldThrow={true} />, undefined, TestFallback);

    // Verify that both error and errorInfo are available in the fallback
    expect(screen.getByText('Error: Test error message')).toBeInTheDocument();
    expect(screen.getByText('Error info available')).toBeInTheDocument();
  });

  it('should reset error state when children change to non-throwing component', () => {
    const { rerender } = renderWithPluginContext(<ThrowingComponent shouldThrow={true} />, undefined, TestFallback);

    // Initially should show fallback
    expect(screen.getByText('Fallback rendered')).toBeInTheDocument();

    // Re-render with non-throwing component
    rerender(
      <PluginContext.Provider value={{ meta: getMockPlugin({ id: 'test-plugin', type: PluginType.panel }) }}>
        <PluginErrorBoundary fallback={TestFallback}>
          <ThrowingComponent shouldThrow={false} />
        </PluginErrorBoundary>
      </PluginContext.Provider>
    );

    // Should still show fallback since error boundary doesn't reset automatically
    expect(screen.getByText('Fallback rendered')).toBeInTheDocument();
  });

  it('should handle multiple children correctly', () => {
    renderWithPluginContext(
      <>
        <div>First child</div>
        <ThrowingComponent shouldThrow={false} />
        <div>Third child</div>
      </>
    );

    expect(screen.getByText('First child')).toBeInTheDocument();
    expect(screen.getByText('Working component')).toBeInTheDocument();
    expect(screen.getByText('Third child')).toBeInTheDocument();
  });

  it('should handle error in one of multiple children', () => {
    renderWithPluginContext(
      <>
        <div>First child</div>
        <ThrowingComponent shouldThrow={true} />
        <div>Third child</div>
      </>,
      undefined,
      TestFallback
    );

    // Should show fallback and not render any of the children
    expect(screen.getByText('Fallback rendered')).toBeInTheDocument();
    expect(screen.queryByText('First child')).not.toBeInTheDocument();
    expect(screen.queryByText('Third child')).not.toBeInTheDocument();
  });
});
