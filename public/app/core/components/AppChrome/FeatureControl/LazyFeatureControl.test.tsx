import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import { getLocalStorageProvider } from '@grafana/runtime/internal';

import { FeatureControlContext, type FeatureControlContextType } from './FeatureControlProvider';
import { LazyFeatureControlButton, LazyFeatureControlFloating } from './LazyFeatureControl';

const renderWithContext = (ui: ReactNode, context: Partial<FeatureControlContextType> = {}) =>
  render(
    <FeatureControlContext.Provider
      value={{
        isAccessible: false,
        setIsAccessible: jest.fn(),
        isOpen: false,
        setIsOpen: jest.fn(),
        ...context,
      }}
    >
      {ui}
    </FeatureControlContext.Provider>
  );

describe('LazyFeatureControl', () => {
  beforeEach(() => {
    window.localStorage.clear();
    getLocalStorageProvider().clearFlags();
  });

  describe('LazyFeatureControlButton', () => {
    it('renders nothing when feature control is not accessible', () => {
      const { container } = renderWithContext(<LazyFeatureControlButton />, { isAccessible: false });

      expect(container).toBeEmptyDOMElement();
    });

    it('loads the button when feature control is accessible', async () => {
      renderWithContext(<LazyFeatureControlButton />, { isAccessible: true });

      expect(await screen.findByRole('button', { name: 'Feature control' })).toBeInTheDocument();
    });
  });

  describe('LazyFeatureControlFloating', () => {
    it('renders nothing when the panel is closed', () => {
      const { container } = renderWithContext(<LazyFeatureControlFloating />, { isOpen: false });

      expect(container).toBeEmptyDOMElement();
    });

    it('loads the panel when it is open', async () => {
      renderWithContext(<LazyFeatureControlFloating />, { isOpen: true });

      expect(await screen.findByText('Feature control')).toBeInTheDocument();
    });
  });
});
