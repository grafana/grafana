import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';

import * as runtimeInternal from '@grafana/runtime/internal';
import { getLocalStorageProvider } from '@grafana/runtime/internal';
import { mockComboboxRect } from '@grafana/test-utils';
import type { CodeEditor } from '@grafana/ui';

import { FeatureControlFlag, type FeatureControlFlagProps } from './FeatureControlFlag';

type CodeEditorProps = ComponentProps<typeof CodeEditor>;

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  CodeEditor: ({ value, onChange }: CodeEditorProps) => (
    <textarea aria-label="Flag value" value={value} onChange={(e) => onChange?.(e.target.value)} />
  ),
}));

type Flag = NonNullable<FeatureControlFlagProps['flag']>;

const renderComponent = (flag?: Flag) => render(<FeatureControlFlag flag={flag} />);

const getStorageKey = (flagName: string) => `grafana.openfeature.${flagName}`;

const expandFlag = async (flagName: string) => {
  await userEvent.click(screen.getByText(flagName));

  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Save' })).toBeVisible();
  });
};

const changeType = async (type: string) => {
  await userEvent.click(screen.getByRole('combobox', { name: 'Flag type' }));
  await userEvent.click(screen.getByRole('option', { name: type }));
};

const changeValue = async (input: string, type: string) => {
  if (type === 'boolean') {
    await userEvent.click(screen.getByRole('radio', { name: input }));
  } else {
    const elm = screen.getByRole(type === 'number' ? 'spinbutton' : 'textbox', { name: 'Flag value' });
    await userEvent.clear(elm);
    await userEvent.type(elm, input);
  }
};

describe('FeatureControlFlag', () => {
  beforeAll(() => {
    mockComboboxRect();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    getLocalStorageProvider().clearFlags();
  });

  [
    { type: 'boolean', before: { storage: 'true', expected: 'true' }, after: { input: 'true', expected: 'true' } },
    { type: 'number', before: { storage: '42', expected: '42' }, after: { input: '42', expected: '42' } },
    {
      type: 'string',
      before: { storage: 'hello world', expected: 'hello world' },
      after: { input: 'hello world', expected: 'hello world' },
    },
    {
      type: 'object',
      before: { storage: '{"key":"value"}', expected: '{\n  "key": "value"\n}' },
      after: { input: '{{"key": "value"}}', expected: '{"key":"value"}' },
    },
  ].map(({ type, before, after }) => {
    describe(`${type} flags`, () => {
      it('adds a new flag', async () => {
        expect(window.localStorage.getItem(getStorageKey('alpha'))).toBeNull();

        renderComponent();
        await expandFlag('new-flag-override');

        await userEvent.type(screen.getByRole('combobox', { name: 'Flag key' }), 'alpha[Enter]');
        await changeType(type);
        await changeValue(after.input, type);

        await userEvent.click(screen.getByRole('button', { name: 'Save' }));
        await waitFor(() => {
          expect(window.localStorage.getItem(getStorageKey('alpha'))).toBe(after.expected);
        });
      });

      it('updates an existing flag', async () => {
        getLocalStorageProvider().setFlags({ alpha: before.storage });

        renderComponent({ key: 'alpha', value: before.storage });
        await expandFlag('alpha');

        expect(screen.getByRole('textbox', { name: 'Flag key' })).toHaveValue('alpha');
        expect(screen.getByRole('combobox', { name: 'Flag type' })).toHaveValue(type);

        if (type === 'boolean') {
          expect(screen.getByRole('radio', { name: before.expected })).toBeChecked();
          expect(screen.getByRole('radio', { name: before.expected === 'true' ? 'false' : 'true' })).not.toBeChecked();
        } else {
          expect(screen.getByRole(type === 'number' ? 'spinbutton' : 'textbox', { name: 'Flag value' })).toHaveValue(
            type === 'number' ? Number(before.expected) : before.expected
          );
        }

        await changeValue(after.input, type);

        await userEvent.click(screen.getByRole('button', { name: 'Save' }));
        await waitFor(() => {
          expect(window.localStorage.getItem(getStorageKey('alpha'))).toBe(after.expected);
        });
      });
    });
  });

  it('removes an existing flag', async () => {
    getLocalStorageProvider().setFlags({ alpha: true });

    renderComponent({ key: 'alpha', value: 'true' });
    await expandFlag('alpha');

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(window.localStorage.getItem(getStorageKey('alpha'))).toBeNull();
    });
  });

  it('shows known flag names in the flag key combobox', async () => {
    const mockOFREPProvider = {
      flagCache: { 'feature-alpha': true, 'feature-beta': false } as Record<string, unknown>,
      events: { addHandler: jest.fn(), removeHandler: jest.fn() },
    };
    jest.spyOn(runtimeInternal, 'getOFREPWebProvider').mockReturnValue(mockOFREPProvider as never);

    renderComponent();
    await expandFlag('new-flag-override');

    await userEvent.click(screen.getByRole('combobox', { name: 'Flag key' }));
    expect(screen.getByRole('option', { name: 'feature-alpha' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'feature-beta' })).toBeInTheDocument();
  });
});
