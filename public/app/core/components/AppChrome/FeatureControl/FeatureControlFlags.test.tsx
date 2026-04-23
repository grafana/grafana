import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { getLocalStorageProvider } from '@grafana/runtime/internal';

import { FeatureControlFlags } from './FeatureControlFlags';
import { FeatureControlContext, type FeatureControlContextType } from './FeatureControlProvider';

const setIsAccessible = jest.fn();
const setIsOpen = jest.fn();
const setCorner = jest.fn();

const buildContext = (overrides: Partial<FeatureControlContextType> = {}): FeatureControlContextType => ({
  isAccessible: true,
  setIsAccessible,
  isOpen: true,
  setIsOpen,
  corner: 'bottom-right',
  setCorner,
  ...overrides,
});

const renderComponent = (contextOverrides: Partial<FeatureControlContextType> = {}) => {
  return render(
    <FeatureControlContext.Provider value={buildContext(contextOverrides)}>
      <FeatureControlFlags />
    </FeatureControlContext.Provider>
  );
};

const getStorageKey = (flagName: string) => `grafana.openfeature.${flagName}`;

const expandFlag = async (flagName: string) => {
  fireEvent.click(screen.getByText(flagName));

  await waitFor(() => {
    expect(screen.getAllByRole('button', { name: 'Save' })[0]).toBeVisible();
  });
};

describe('FeatureControlFlags', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    getLocalStorageProvider().clearFlags();
  });

  it('renders flags from local storage', async () => {
    getLocalStorageProvider().setFlags({ alpha: true, beta: 'custom-value' });

    renderComponent();

    expect(await screen.findByText('alpha')).toBeInTheDocument();
    expect(screen.getByText('beta')).toBeInTheDocument();
    expect(screen.getByText('custom-value')).toBeInTheDocument();
  });

  it('updates an existing flag', async () => {
    getLocalStorageProvider().setFlags({ alpha: 'hello' });

    renderComponent();
    await expandFlag('alpha');

    fireEvent.change(screen.getAllByLabelText('Flag value')[0], { target: { value: 'world' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);

    await waitFor(() => {
      expect(window.localStorage.getItem(getStorageKey('alpha'))).toBe('world');
    });

    const summary = screen.getByText('alpha').closest('summary');
    expect(summary).not.toBeNull();
    expect(within(summary as HTMLElement).getByText('world')).toBeInTheDocument();
  });

  it('removes an existing flag', async () => {
    getLocalStorageProvider().setFlags({ alpha: true });

    renderComponent();
    await expandFlag('alpha');

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);

    await waitFor(() => {
      expect(window.localStorage.getItem(getStorageKey('alpha'))).toBeNull();
    });

    expect(screen.queryByText('alpha')).not.toBeInTheDocument();
  });

  it('dismisses feature control', () => {
    getLocalStorageProvider().setFlags({ alpha: true });

    renderComponent();

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss feature control' }));

    expect(setIsOpen).toHaveBeenCalledWith(false);
    expect(setIsAccessible).toHaveBeenCalledWith(false);
    expect(window.localStorage.getItem(getStorageKey('alpha'))).toBe('true');
  });
});
