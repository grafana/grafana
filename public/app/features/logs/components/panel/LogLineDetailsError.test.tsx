import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  type ChatContextItem,
  createAssistantContextItem,
  OpenAssistantButton,
  useAssistant,
} from '@grafana/assistant';

import { type FieldDef } from '../logParser';
import { OTEL_LANGUAGE_UNKNOWN } from '../otel/formats';

import { LogLineDetailsError } from './LogLineDetailsError';

const useAssistantMock = jest.mocked(useAssistant);
const openAssistantButtonMock = jest.mocked(OpenAssistantButton);
const createAssistantContextItemMock = jest.mocked(createAssistantContextItem);

function field(key: string, value: string, fieldIndex: number): FieldDef {
  return { keys: [key], values: [value], fieldIndex };
}

const errorFields = [
  field('exception.type', 'NullPointerException', 0),
  field('exception.message', 'Cannot invoke `User.getId()`', 1),
  field('exception.stacktrace', 'at UserService.getUserId', 2),
];

function enableAssistant() {
  useAssistantMock.mockReturnValue({
    isLoading: false,
    isAvailable: true,
    openAssistant: jest.fn(),
    closeAssistant: jest.fn(),
    toggleAssistant: jest.fn(),
  });
}

describe('LogLineDetailsError', () => {
  beforeEach(() => {
    useAssistantMock.mockReturnValue({
      isLoading: false,
      isAvailable: false,
      openAssistant: undefined,
      closeAssistant: jest.fn(),
      toggleAssistant: jest.fn(),
    });
    // Echoes back the raw type/params instead of the real node/occurrences shape, so tests can assert on
    // what was passed in without needing to know createAssistantContextItem's actual transformation.
    createAssistantContextItemMock.mockImplementation(
      (type, params) => ({ type, ...params }) as unknown as ChatContextItem
    );
    openAssistantButtonMock.mockImplementation(({ title }) => <button type="button">{title}</button>);
  });

  it('keeps the stack trace collapsed until it is expanded', async () => {
    const user = userEvent.setup();

    render(
      <LogLineDetailsError
        fields={[
          field('exception.message', 'Cannot invoke User.getId()', 0),
          field('exception.stacktrace', 'at UserService.getUserId', 1),
        ]}
        labels={[]}
      />
    );

    expect(screen.getByText('Cannot invoke User.getId()')).toBeInTheDocument();
    expect(screen.queryByText('at UserService.getUserId')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'exception.stacktrace' })).toHaveAttribute('aria-expanded', 'false');

    await user.click(screen.getByRole('button', { name: 'exception.stacktrace' }));

    expect(screen.getByText('at UserService.getUserId')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'exception.stacktrace' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('hides the assistant action when Grafana Assistant is unavailable', () => {
    render(<LogLineDetailsError fields={errorFields} labels={[{ key: 'error', value: 'true' }]} />);

    expect(screen.getByText('Cannot invoke `User.getId()`')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Diagnose with assistant' })).not.toBeInTheDocument();
  });

  it('starts a new assistant conversation with the error details', () => {
    enableAssistant();

    render(<LogLineDetailsError fields={errorFields} labels={[{ key: 'error', value: 'true' }]} />);

    expect(screen.getByRole('button', { name: 'Diagnose with assistant' })).toBeInTheDocument();
    expect(openAssistantButtonMock.mock.lastCall?.[0]).toEqual({
      origin: 'grafana/logs/diagnose-log-error',
      autoSend: true,
      size: 'sm',
      title: 'Diagnose with assistant',
      prompt: `Diagnose this error from a log line. Explain the likely cause and what to check next.

\`\`\`
exception.type: NullPointerException
error: true
exception.message: Cannot invoke \\\`User.getId()\\\`
exception.stacktrace: at UserService.getUserId
\`\`\``,
      context: [
        {
          type: 'structured',
          title: 'Error details',
          data: {
            attributes: [
              { key: 'exception.type', value: 'NullPointerException' },
              { key: 'error', value: 'true' },
              { key: 'exception.message', value: 'Cannot invoke `User.getId()`' },
              { key: 'exception.stacktrace', value: 'at UserService.getUserId' },
            ],
          },
        },
      ],
      onClick: expect.any(Function),
    });
  });

  it('names the OpenTelemetry language in the diagnose prompt', () => {
    enableAssistant();

    render(<LogLineDetailsError fields={errorFields} labels={[{ key: 'error', value: 'true' }]} otelLanguage="java" />);

    expect(openAssistantButtonMock.mock.lastCall?.[0].prompt)
      .toBe(`Diagnose this error from an OpenTelemetry java log line. Explain the likely cause and what to check next.

\`\`\`
exception.type: NullPointerException
error: true
exception.message: Cannot invoke \\\`User.getId()\\\`
exception.stacktrace: at UserService.getUserId
\`\`\``);
    expect(openAssistantButtonMock.mock.lastCall?.[0].context).toEqual([
      {
        type: 'structured',
        title: 'Error details',
        data: {
          language: 'java',
          attributes: [
            { key: 'exception.type', value: 'NullPointerException' },
            { key: 'error', value: 'true' },
            { key: 'exception.message', value: 'Cannot invoke `User.getId()`' },
            { key: 'exception.stacktrace', value: 'at UserService.getUserId' },
          ],
        },
      },
    ]);
  });

  it.each([
    { otelLanguage: '', label: 'empty' },
    { otelLanguage: '   ', label: 'blank' },
    { otelLanguage: OTEL_LANGUAGE_UNKNOWN, label: 'unknown' },
  ])('leaves an $label OpenTelemetry language out of the prompt and context', ({ otelLanguage }) => {
    enableAssistant();

    render(
      <LogLineDetailsError
        fields={errorFields}
        labels={[{ key: 'error', value: 'true' }]}
        otelLanguage={otelLanguage}
      />
    );

    expect(openAssistantButtonMock.mock.lastCall?.[0].prompt).toBe(
      `Diagnose this error from a log line. Explain the likely cause and what to check next.

\`\`\`
exception.type: NullPointerException
error: true
exception.message: Cannot invoke \\\`User.getId()\\\`
exception.stacktrace: at UserService.getUserId
\`\`\``
    );
    expect(openAssistantButtonMock.mock.lastCall?.[0].context).toEqual([
      {
        type: 'structured',
        title: 'Error details',
        data: {
          attributes: [
            { key: 'exception.type', value: 'NullPointerException' },
            { key: 'error', value: 'true' },
            { key: 'exception.message', value: 'Cannot invoke `User.getId()`' },
            { key: 'exception.stacktrace', value: 'at UserService.getUserId' },
          ],
        },
      },
    ]);
  });
});
