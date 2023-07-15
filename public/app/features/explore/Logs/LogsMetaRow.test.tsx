import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import saveAs from 'file-saver';
import React, { ComponentProps } from 'react';

import { LogLevel, LogsDedupStrategy, MutableDataFrame } from '@grafana/data';

import { MAX_CHARACTERS } from '../../logs/components/LogRowMessage';
import { logRowsToReadableJson } from '../../logs/utils';

import { LogsMetaRow } from './LogsMetaRow';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: () => null,
}));

jest.mock('file-saver', () => jest.fn());

type LogsMetaRowProps = ComponentProps<typeof LogsMetaRow>;
const defaultProps: LogsMetaRowProps = {
  meta: [],
  dedupStrategy: LogsDedupStrategy.none,
  dedupCount: 0,
  displayedFields: [],
  hasUnescapedContent: false,
  forceEscape: false,
  logRows: [],
  onEscapeNewlines: jest.fn(),
  clearDetectedFields: jest.fn(),
};

const setup = (propOverrides?: object) => {
  const props = {
    ...defaultProps,
    ...propOverrides,
  };

  return render(<LogsMetaRow {...props} />);
};

describe('LogsMetaRow', () => {
  it('renders the dedupe number', async () => {
    setup({ dedupStrategy: LogsDedupStrategy.numbers, dedupCount: 1234 });
    expect(await screen.findByText('1234')).toBeInTheDocument();
  });

  it('renders a highlighting warning', async () => {
    setup({ logRows: [{ entry: 'A'.repeat(MAX_CHARACTERS + 1) }] });
    expect(
      await screen.findByText('Logs with more than 100,000 characters could not be parsed and highlighted')
    ).toBeInTheDocument();
  });

  it('renders the show original line button', () => {
    setup({ displayedFields: ['test'] });
    expect(
      screen.getByRole('button', {
        name: 'Show original line',
      })
    ).toBeInTheDocument();
  });

  it('renders the displayedfield', async () => {
    setup({ displayedFields: ['testField1234'] });
    expect(await screen.findByText('testField1234')).toBeInTheDocument();
  });

  it('renders a button to clear displayedfields', () => {
    const clearSpy = jest.fn();
    setup({ displayedFields: ['testField1234'], clearDetectedFields: clearSpy });
    fireEvent(
      screen.getByRole('button', {
        name: 'Show original line',
      }),
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );
    expect(clearSpy).toBeCalled();
  });

  it('renders a button to remove escaping', () => {
    setup({ hasUnescapedContent: true, forceEscape: true });
    expect(
      screen.getByRole('button', {
        name: 'Remove escaping',
      })
    ).toBeInTheDocument();
  });

  it('renders a button to remove escaping', () => {
    setup({ hasUnescapedContent: true, forceEscape: false });
    expect(
      screen.getByRole('button', {
        name: 'Escape newlines',
      })
    ).toBeInTheDocument();
  });

  it('renders a button to remove escaping', () => {
    const escapeSpy = jest.fn();
    setup({ hasUnescapedContent: true, forceEscape: false, onEscapeNewlines: escapeSpy });
    fireEvent(
      screen.getByRole('button', {
        name: 'Escape newlines',
      }),
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );
    expect(escapeSpy).toBeCalled();
  });

  it('renders a button to show the download menu', () => {
    setup();
    expect(screen.getByText('Download').closest('button')).toBeInTheDocument();
  });

  it('renders a button to show the download menu', async () => {
    setup();

    expect(screen.queryAllByText('txt')).toHaveLength(0);
    await userEvent.click(screen.getByText('Download').closest('button')!);
    expect(
      screen.getByRole('menuitem', {
        name: 'txt',
      })
    ).toBeInTheDocument();
  });

  it('renders a button to download txt', async () => {
    setup();

    await userEvent.click(screen.getByText('Download').closest('button')!);

    await userEvent.click(
      screen.getByRole('menuitem', {
        name: 'txt',
      })
    );

    expect(saveAs).toBeCalled();
  });

  it('renders a button to download json', async () => {
    const rows = [
      {
        rowIndex: 1,
        entryFieldIndex: 0,
        dataFrame: new MutableDataFrame(),
        entry: 'test entry',
        hasAnsi: false,
        hasUnescapedContent: false,
        labels: {
          foo: 'bar',
        },
        logLevel: LogLevel.info,
        raw: '',
        timeEpochMs: 10,
        timeEpochNs: '123456789',
        timeFromNow: '',
        timeLocal: '',
        timeUtc: '',
        uid: '2',
      },
    ];
    setup({ logRows: rows });

    await userEvent.click(screen.getByText('Download').closest('button')!);

    await userEvent.click(
      screen.getByRole('menuitem', {
        name: 'json',
      })
    );

    expect(saveAs).toBeCalled();
    const blob = (saveAs as unknown as jest.Mock).mock.lastCall[0];
    expect(blob.type).toBe('application/json;charset=utf-8');
    const text = await blob.text();
    expect(text).toBe(JSON.stringify(logRowsToReadableJson(rows)));
  });
});
