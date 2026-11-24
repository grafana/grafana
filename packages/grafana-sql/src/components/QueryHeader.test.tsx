import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { EditorMode } from '@grafana/plugin-ui';
import { copyTextToClipboard } from '@grafana/ui';

import { applyQueryDefaults } from '../defaults';
import { type DB } from '../types';

import { QueryHeader } from './QueryHeader';

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  copyTextToClipboard: jest.fn(),
}));

const copy = jest.mocked(copyTextToClipboard);
const editedSql = 'SELECT 42';
const builderSql = 'SELECT * FROM example';
const errorMessage = 'Could not copy SQL to the clipboard. Your code has not been changed.';

async function setup() {
  const user = userEvent.setup();
  const query = applyQueryDefaults({ refId: 'A', editorMode: EditorMode.Code, rawSql: editedSql });
  const onChange = jest.fn();
  const toRawSql = jest.fn().mockReturnValue(builderSql);
  const db: DB = {
    datasets: jest.fn().mockResolvedValue([]),
    tables: jest.fn().mockResolvedValue([]),
    fields: jest.fn().mockResolvedValue([]),
    validateQuery: jest.fn(),
    getEditorLanguageDefinition: jest.fn(),
    toRawSql,
    functions: jest.fn().mockReturnValue([]),
  };

  render(
    <QueryHeader
      db={db}
      dialect="postgres"
      isQueryRunnable={true}
      onChange={onChange}
      onQueryRowChange={jest.fn()}
      onRunQuery={jest.fn()}
      preconfiguredDataset=""
      query={query}
      queryRowFilter={{ filter: false, group: false, order: false, preview: false }}
      hideFormatSelector
      hideRunButton
    />
  );

  await user.click(screen.getByRole('radio', { name: 'Builder' }));
  const dialog = within(screen.getByRole('dialog'));
  const copyButton = dialog.getByRole('button', { name: 'Copy code and switch' });
  return { user, query, onChange, toRawSql, dialog, copyButton };
}

describe('QueryHeader code to builder confirmation', () => {
  beforeEach(() => {
    copy.mockReset();
    copy.mockResolvedValue(undefined);
  });

  it('preserves edited SQL on copy failure and allows retry', async () => {
    copy.mockRejectedValueOnce(new Error('Copy refused'));
    const { user, query, onChange, toRawSql, dialog, copyButton } = await setup();

    await user.click(copyButton);

    expect(copy).toHaveBeenCalledWith(editedSql, expect.objectContaining({ current: expect.any(HTMLDivElement) }));
    expect(await dialog.findByRole('alert', { name: errorMessage })).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(toRawSql).not.toHaveBeenCalled();
    expect(copyButton).toBeEnabled();

    await user.click(copyButton);

    expect(copy).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ ...query, rawSql: builderSql, editorMode: EditorMode.Builder });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('waits for clipboard success before switching modes', async () => {
    let resolveCopy!: () => void;
    copy.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveCopy = resolve;
      })
    );
    const { user, query, onChange, copyButton } = await setup();

    await user.click(copyButton);

    expect(copyButton).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await act(async () => resolveCopy());

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ ...query, rawSql: builderSql, editorMode: EditorMode.Builder });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('allows cancelling after a failed copy', async () => {
    copy.mockRejectedValueOnce(new Error('Copy refused'));
    const { user, onChange, dialog, copyButton } = await setup();

    await user.click(copyButton);
    await dialog.findByRole('alert', { name: errorMessage });
    await user.click(dialog.getByRole('button', { name: 'Cancel' }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Builder' }));
    expect(within(screen.getByRole('dialog')).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('allows explicit discard after a failed copy', async () => {
    copy.mockRejectedValueOnce(new Error('Copy refused'));
    const { user, query, onChange, dialog, copyButton } = await setup();

    await user.click(copyButton);
    await dialog.findByRole('alert', { name: errorMessage });
    await user.click(dialog.getByRole('button', { name: 'Discard code and switch' }));

    expect(copy).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ ...query, rawSql: builderSql, editorMode: EditorMode.Builder });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it.each([true, false])('handles legacy clipboard copying inside the dialog (success: %s)', async (success) => {
    const { user, query, onChange, dialog, copyButton } = await setup();
    const actual = jest.requireActual<{ copyTextToClipboard: typeof copyTextToClipboard }>('@grafana/ui');
    copy.mockImplementationOnce(actual.copyTextToClipboard);

    const secureContextDescriptor = Object.getOwnPropertyDescriptor(window, 'isSecureContext');
    const execCommandDescriptor = Object.getOwnPropertyDescriptor(document, 'execCommand');
    let clipboardTextarea: HTMLElement | null = null;
    let focusedElement: Element | null = null;
    const execCommand = jest.fn(() => {
      clipboardTextarea = dialog.queryByDisplayValue(editedSql);
      focusedElement = document.activeElement;
      return success;
    });

    try {
      Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false });
      Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });
      await user.click(copyButton);

      expect(execCommand).toHaveBeenCalledWith('copy');
      expect(clipboardTextarea).toBeInstanceOf(HTMLTextAreaElement);
      expect(focusedElement).toBe(clipboardTextarea);
      expect(screen.queryByDisplayValue(editedSql)).not.toBeInTheDocument();

      expect(onChange.mock.calls).toEqual(
        success ? [[{ ...query, rawSql: builderSql, editorMode: EditorMode.Builder }]] : []
      );
      expect(Boolean(screen.queryByRole('dialog'))).toBe(!success);
      expect(Boolean(screen.queryByRole('alert', { name: errorMessage }))).toBe(!success);
    } finally {
      if (secureContextDescriptor) {
        Object.defineProperty(window, 'isSecureContext', secureContextDescriptor);
      } else {
        Reflect.deleteProperty(window, 'isSecureContext');
      }
      if (execCommandDescriptor) {
        Object.defineProperty(document, 'execCommand', execCommandDescriptor);
      } else {
        Reflect.deleteProperty(document, 'execCommand');
      }
    }
  });

  it('does not switch modes when a pending copy succeeds after cancellation', async () => {
    let resolveCopy!: () => void;
    copy.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveCopy = resolve;
      })
    );
    const { user, onChange, dialog, copyButton } = await setup();

    await user.click(copyButton);
    await user.click(dialog.getByRole('button', { name: 'Cancel' }));
    await act(async () => resolveCopy());

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
