import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { getLocalStorageProvider } from '@grafana/runtime/internal';

import { FeatureControlFlags } from './FeatureControlFlags';
import { FeatureControlContext } from './FeatureControlProvider';

const setIsAccessible = jest.fn();
const setIsOpen = jest.fn();

const renderComponent = () => {
  return render(
    <FeatureControlContext.Provider
      value={{
        isAccessible: true,
        setIsAccessible,
        isOpen: true,
        setIsOpen,
      }}
    >
      <FeatureControlFlags />
    </FeatureControlContext.Provider>
  );
};

const getStorageKey = (flagName: string) => `grafana.openfeature.${flagName}`;

describe('FeatureControlFlags', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    getLocalStorageProvider().clearFlags();
    delete window.__grafanaPreviewAssets;
  });

  it('renders flags from local storage', async () => {
    getLocalStorageProvider().setFlags({ alpha: true, beta: 'custom-value' });

    renderComponent();

    expect(await screen.findByText('alpha')).toBeInTheDocument();
    expect(screen.getByText('beta')).toBeInTheDocument();
    expect(screen.getByText('custom-value')).toBeInTheDocument();
  });

  it('dismisses feature control', async () => {
    getLocalStorageProvider().setFlags({ alpha: true });

    renderComponent();

    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    await userEvent.click(screen.getByRole('menuitem', { name: /Remove UI and toolbar button/ }));

    expect(setIsOpen).toHaveBeenCalledWith(false);
    expect(setIsAccessible).toHaveBeenCalledWith(false);
    expect(window.localStorage.getItem(getStorageKey('alpha'))).toBe('true');
  });

  it('does not show the preview assets message by default', () => {
    renderComponent();

    expect(screen.queryByText('Frontend preview active')).not.toBeInTheDocument();
  });

  it('shows the preview assets message when preview assets are active', () => {
    window.__grafanaPreviewAssets = 'pr_grafana_123456';

    renderComponent();

    const previewStatus = screen.getByRole('status');
    expect(previewStatus).toHaveTextContent('Frontend preview active');
    expect(previewStatus).toHaveTextContent('Build pr_grafana_123456 live for just you.');
    expect(screen.getByRole('button', { name: 'Stop preview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy share link' })).toBeInTheDocument();
  });

  it('copies a link that enables the active preview assets', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    const user = userEvent.setup();
    window.__grafanaPreviewAssets = 'pr_grafana_123456';

    renderComponent();
    await user.click(screen.getByRole('button', { name: 'Copy share link' }));

    expect(await navigator.clipboard.readText()).toBe(
      `${window.location.origin}/-/set-preview-assets?assets=pr_grafana_123456`
    );
  });
});
