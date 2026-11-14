import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import type { ComponentProps } from 'react';

import { getLocalStorageProvider } from '@grafana/runtime/internal';
import { mockComboboxRect } from '@grafana/test-utils';
import type { CodeMirrorEditor } from '@grafana/ui/unstable';

import { FeatureControlFlag, type FeatureControlFlagProps } from './FeatureControlFlag';

type CodeMirrorEditorProps = ComponentProps<typeof CodeMirrorEditor>;

jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  FlagKeys: {
    FeatureControlFlagTestOnly: 'feature-gamma',
  },
  getOFREPWebProvider: jest.fn().mockReturnValue({
    flagCache: {
      'feature-alpha': { value: true, reason: 'DEFAULT', variant: 'enabled' },
      'feature-beta': { value: false, reason: 'TARGETING_MATCH', variant: 'disabled' },
      'feature-object': { value: { enabled: true, cohort: 'staff' }, reason: 'STATIC', variant: 'staff' },
      'feature-error': { errorCode: 'FLAG_NOT_FOUND', errorDetails: 'No provider result found for this flag.' },
    } as Record<string, unknown>,
    events: { addHandler: jest.fn(), removeHandler: jest.fn() },
  } as never),
}));

jest.mock('@grafana/ui/unstable', () => ({
  ...jest.requireActual('@grafana/ui/unstable'),
  CodeMirrorEditor: ({
    value,
    onChange,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
  }: CodeMirrorEditorProps) => (
    <textarea
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

type Flag = NonNullable<FeatureControlFlagProps['flag']>;

const renderComponent = (flag?: Flag, props?: Partial<FeatureControlFlagProps>) =>
  render(<FeatureControlFlag flag={flag} {...props} />);

const getStorageKey = (flagName: string) => `grafana.openfeature.${flagName}`;

const expandFlag = async (user: UserEvent, flagName: string) => {
  await user.click(screen.getByText(flagName));

  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Save' })).toBeVisible();
  });
};

const changeType = async (user: UserEvent, type: string) => {
  await user.click(screen.getByRole('combobox', { name: 'Flag type' }));
  await user.click(screen.getByRole('option', { name: type }));
};

const changeValue = async (user: UserEvent, input: string, type: string) => {
  if (type === 'boolean') {
    await user.click(screen.getByRole('radio', { name: input }));
  } else {
    const elm = screen.getByRole(type === 'number' ? 'spinbutton' : 'textbox', { name: 'Flag value' });
    await user.clear(elm);
    await user.type(elm, input);
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

  it.each([
    { type: 'boolean', value: 'true' },
    { type: 'number', value: '42' },
    { type: 'string', value: 'hello' },
    { type: 'object', value: '{"enabled":true}' },
  ])('labels the $type value control with a screen-reader-only label', async ({ value }) => {
    const user = userEvent.setup();
    renderComponent({ key: 'alpha', value });
    await expandFlag(user, 'alpha');

    expect(screen.getByLabelText('Flag value')).toHaveAccessibleName('Flag value');
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
        const user = userEvent.setup();
        expect(window.localStorage.getItem(getStorageKey('alpha'))).toBeNull();

        renderComponent(undefined);

        await user.type(screen.getByRole('combobox', { name: 'Flag key' }), 'alpha[Enter]');
        await changeType(user, type);
        await changeValue(user, after.input, type);

        await user.click(screen.getByRole('button', { name: 'Save' }));
        await waitFor(() => {
          expect(window.localStorage.getItem(getStorageKey('alpha'))).toBe(after.expected);
        });
      });

      it('updates an existing flag', async () => {
        const user = userEvent.setup();
        getLocalStorageProvider().setFlags({ alpha: before.storage });

        renderComponent({ key: 'alpha', value: before.storage });
        await expandFlag(user, 'alpha');

        expect(screen.getByRole('combobox', { name: 'Flag type' })).toHaveValue(type);

        if (type === 'boolean') {
          expect(screen.getByRole('radio', { name: before.expected })).toBeChecked();
          expect(screen.getByRole('radio', { name: before.expected === 'true' ? 'false' : 'true' })).not.toBeChecked();
        } else {
          expect(screen.getByRole(type === 'number' ? 'spinbutton' : 'textbox', { name: 'Flag value' })).toHaveValue(
            type === 'number' ? Number(before.expected) : before.expected
          );
        }

        await changeValue(user, after.input, type);

        await user.click(screen.getByRole('button', { name: 'Save' }));
        await waitFor(() => {
          expect(window.localStorage.getItem(getStorageKey('alpha'))).toBe(after.expected);
        });
      });
    });
  });

  it('saves the latest JSON immediately after typing', async () => {
    const user = userEvent.setup();
    renderComponent({ key: 'alpha', value: '{"count":1}' });
    await user.click(screen.getByText('alpha'));

    const editor = screen.getByRole('textbox', { name: 'Flag value' });
    await user.clear(editor);
    await user.type(editor, '{{"count":2}');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(window.localStorage.getItem(getStorageKey('alpha'))).toBe('{"count":2}');
  });

  it('keeps invalid JSON drafts and the last valid value, then clears the error when corrected', async () => {
    const user = userEvent.setup();
    renderComponent({ key: 'alpha', value: '{"count":1}' });
    await user.click(screen.getByText('alpha'));

    const editor = screen.getByRole('textbox', { name: 'Flag value' });
    await user.clear(editor);
    await user.type(editor, '{{"count":2}');
    await user.type(editor, 'x');

    expect(editor).toHaveValue('{"count":2}x');
    expect(screen.getByRole('alert')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(window.localStorage.getItem(getStorageKey('alpha'))).toBe('{"count":2}');

    await user.click(editor);
    await user.keyboard('{End}{Backspace}');
    expect(editor).toHaveValue('{"count":2}');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('removes an existing flag', async () => {
    const user = userEvent.setup();
    getLocalStorageProvider().setFlags({ alpha: true });

    renderComponent({ key: 'alpha', value: 'true' });
    await expandFlag(user, 'alpha');

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(window.localStorage.getItem(getStorageKey('alpha'))).toBeNull();
    });
  });

  it('autofocuses the flag key input when rendered as the new-flag form', async () => {
    renderComponent(undefined, { autoFocus: true });

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Flag key' })).toHaveFocus();
    });
  });

  it('calls onDone after saving a new flag', async () => {
    const user = userEvent.setup();
    const onDone = jest.fn();
    renderComponent(undefined, { onDone });

    await user.type(screen.getByRole('combobox', { name: 'Flag key' }), 'alpha[Enter]');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onDone).toHaveBeenCalled();
    });
  });

  it('cancels the new-flag form via onDone without saving', async () => {
    const user = userEvent.setup();
    const onDone = jest.fn();
    renderComponent(undefined, { onDone });

    await user.type(screen.getByRole('combobox', { name: 'Flag key' }), 'alpha[Enter]');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onDone).toHaveBeenCalled();
    expect(window.localStorage.getItem(getStorageKey('alpha'))).toBeNull();
  });

  it('shows known flag names in the flag key combobox', async () => {
    const user = userEvent.setup();
    renderComponent(undefined);

    await user.click(screen.getByRole('combobox', { name: 'Flag key' }));
    expect(screen.getByRole('option', { name: 'feature-alpha' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'feature-beta' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'feature-gamma' })).toBeInTheDocument();
  });

  it('shows the OFREP evaluation when selecting a new flag key', async () => {
    const user = userEvent.setup();
    renderComponent(undefined);

    await user.type(screen.getByRole('combobox', { name: 'Flag key' }), 'feature-alpha[Enter]');

    expect(screen.getByText('OFREP evaluation')).toBeInTheDocument();
    expect(screen.getAllByText('true')).toHaveLength(2);
  });

  it('shows the OFREP evaluation value, variant and reason for an existing flag', async () => {
    const user = userEvent.setup();
    renderComponent({ key: 'feature-alpha', value: 'false' });
    await expandFlag(user, 'feature-alpha');

    expect(screen.getByText('OFREP evaluation')).toBeInTheDocument();
    expect(screen.getAllByText('true')).toHaveLength(2);

    // The summary row also shows a blue info-circle for a differing override, so
    // hover the one in the expanded body (outside the <summary>).
    const bodyInfoIcon = screen.getAllByTestId('icon-info-circle').find((el) => !el.closest('summary'));
    await user.hover(bodyInfoIcon!);
    const tooltip = await screen.findByRole('tooltip');
    expect(within(tooltip).getByText('enabled')).toBeInTheDocument();
    expect(within(tooltip).getByText('DEFAULT')).toBeInTheDocument();
  });

  it('marks an override that matches the evaluated value', async () => {
    renderComponent({ key: 'feature-alpha', value: 'true' });

    expect(await screen.findByTestId('icon-check-circle')).toBeInTheDocument();
  });

  it('marks an override that differs from the evaluated value', async () => {
    renderComponent({ key: 'feature-alpha', value: 'false' });

    const summary = screen.getByText('feature-alpha').closest('summary')!;
    expect(await within(summary).findByTestId('icon-info-circle')).toBeInTheDocument();
  });

  it('marks an override for a flag that is not evaluated by the provider', async () => {
    renderComponent({ key: 'not-evaluated', value: 'true' });

    expect(await screen.findByTestId('icon-exclamation-triangle')).toBeInTheDocument();
  });

  it('shows the full object override value on hover of the summary badge', async () => {
    const user = userEvent.setup();
    renderComponent({ key: 'my-object-flag', value: '{"enabled":true}' });

    await user.hover(screen.getByText('{...}'));
    expect(await screen.findByText('{"enabled":true}')).toBeInTheDocument();
  });

  it('shows the full OFREP object value in the badge tooltip', async () => {
    const user = userEvent.setup();
    renderComponent({ key: 'feature-object', value: 'false' });
    await expandFlag(user, 'feature-object');

    await user.hover(screen.getByText('{...}'));
    expect(await screen.findByText('{"enabled":true,"cohort":"staff"}')).toBeInTheDocument();
  });

  it('shows OFREP error details separately from the error badge', async () => {
    const user = userEvent.setup();
    renderComponent({ key: 'feature-error', value: 'true' });
    await expandFlag(user, 'feature-error');

    expect(screen.getByText('FLAG_NOT_FOUND')).toBeInTheDocument();

    await user.hover(screen.getByTestId('icon-info-circle'));
    expect(await screen.findByText('No provider result found for this flag.')).toBeInTheDocument();
  });
});
