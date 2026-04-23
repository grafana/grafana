import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { getLocalStorageProvider } from '@grafana/runtime/internal';

import { FeatureControlFlag, type FeatureControlFlagProps } from './FeatureControlFlag';

type Flag = NonNullable<FeatureControlFlagProps['flag']>;

const renderComponent = (flag?: Flag) => render(<FeatureControlFlag flag={flag} />);

const getStorageKey = (flagName: string) => `grafana.openfeature.${flagName}`;

const expandFlag = async (flagName: string) => {
  await userEvent.click(screen.getByText(flagName));

  await waitFor(() => {
    expect(screen.getByLabelText('Flag value')).toBeVisible();
  });
};

describe('FeatureControlFlag', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    getLocalStorageProvider().clearFlags();
  });

  it('adds a new flag', async () => {
    renderComponent();
    await expandFlag('new-flag-override');

    await userEvent.type(screen.getByLabelText('Flag key'), 'alpha');
    await userEvent.type(screen.getByLabelText('Flag value'), 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Save override' }));
    await waitFor(() => {
      expect(window.localStorage.getItem(getStorageKey('alpha'))).toBe('true');
    });
  });

  it('updates an existing flag', async () => {
    getLocalStorageProvider().setFlags({ alpha: true });

    renderComponent({ key: 'alpha', value: 'true' });
    await expandFlag('alpha');

    await userEvent.clear(screen.getByLabelText('Flag value'));
    await userEvent.type(screen.getByLabelText('Flag value'), 'false');

    await userEvent.click(screen.getByRole('button', { name: 'Save override' }));
    await waitFor(() => {
      expect(window.localStorage.getItem(getStorageKey('alpha'))).toBe('false');
    });
  });

  it('removes an existing flag', async () => {
    getLocalStorageProvider().setFlags({ alpha: true });

    renderComponent({ key: 'alpha', value: 'true' });
    await expandFlag('alpha');

    await userEvent.click(screen.getByRole('button', { name: 'Delete override' }));
    await waitFor(() => {
      expect(window.localStorage.getItem(getStorageKey('alpha'))).toBeNull();
    });
  });
});
