import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import saveAs from 'file-saver';
import { ComponentProps } from 'react';

import {
  FieldType,
  LogLevel,
  LogsDedupStrategy,
  LogsMetaItem,
  LogsMetaKind,
  standardTransformersRegistry,
  store,
  toDataFrame,
} from '@grafana/data';
import { organizeFieldsTransformer } from '@grafana/data/internal';
import { config } from '@grafana/runtime';

import { logRowsToReadableJson } from '../../logs/utils';
import { extractFieldsTransformer } from '../../transformers/extractFields/extractFields';

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
  logRows: [],
  clearDetectedFields: jest.fn(),
};

const setup = (propOverrides?: object, disableDownload = false) => {
  const props = {
    ...defaultProps,
    ...propOverrides,
  };
  config.exploreHideLogsDownload = disableDownload;

  return render(<LogsMetaRow {...props} />);
};

describe('LogsMetaRow', () => {
  it('renders the dedupe number', async () => {
    setup({ dedupStrategy: LogsDedupStrategy.numbers, dedupCount: 1234 });
    expect(await screen.findByText('1234')).toBeInTheDocument();
  });

  it('renders the show original line button', () => {
    setup({ displayedFields: ['test'] });
    expect(
      screen.getByRole('button', {
        name: 'Show original line',
      })
    ).toBeInTheDocument();
  });

  it('renders the displayed fields', async () => {
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

  it('renders a button to show the download menu', () => {
    setup();
    expect(screen.getByText('Download').closest('button')).toBeInTheDocument();
  });

  it('does not render a button to show the download menu if disabled', async () => {
    setup({}, true);
    expect(screen.queryByText('Download')).toBeNull();
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
        dataFrame: toDataFrame({
          name: 'logs',
          fields: [
            {
              name: 'time',
              type: FieldType.time,
              values: ['1970-01-01T00:00:00Z'],
            },
            {
              name: 'message',
              type: FieldType.string,
              values: ['INFO 1'],
              labels: {
                foo: 'bar',
              },
            },
          ],
        }),
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

  it('renders a button to download CSV', async () => {
    const transformers = [extractFieldsTransformer, organizeFieldsTransformer];
    standardTransformersRegistry.setInit(() => {
      return transformers.map((t) => {
        return {
          id: t.id,
          aliasIds: t.aliasIds,
          name: t.name,
          transformation: t,
          description: t.description,
          editor: () => null,
        };
      });
    });

    const rows = [
      {
        rowIndex: 1,
        entryFieldIndex: 0,
        dataFrame: toDataFrame({
          name: 'logs',
          refId: 'A',
          fields: [
            {
              name: 'time',
              type: FieldType.time,
              values: ['1970-01-01T00:00:00Z'],
            },
            {
              name: 'message',
              type: FieldType.string,
              values: ['INFO 1'],
              labels: {
                foo: 'bar',
              },
            },
          ],
        }),
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
      {
        rowIndex: 2,
        entryFieldIndex: 1,
        dataFrame: toDataFrame({
          name: 'logs',
          refId: 'B',
          fields: [
            {
              name: 'time',
              type: FieldType.time,
              values: [1],
            },
            {
              name: 'message',
              type: FieldType.string,
              values: ['INFO 1'],
              labels: {
                foo: 'bar',
              },
            },
          ],
        }),
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
        name: 'csv',
      })
    );
    expect(saveAs).toBeCalled();

    const blob = (saveAs as unknown as jest.Mock).mock.lastCall[0];
    expect(blob.type).toBe('text/csv;charset=utf-8');
    const text = await blob.text();
    expect(text).toBe(`"Date","time","message bar"\r\n1970-01-01T00:00:00.001Z,1,INFO 1`);
  });

  it('renders common labels', async () => {
    const meta: LogsMetaItem[] = [
      {
        label: 'Common labels',
        value: {
          exporter: 'OTLP',
          job: 'cicd-o11y/grafana-deployment-tools',
        },
        kind: LogsMetaKind.LabelsMap,
      },
    ];
    setup({ meta });
    expect(await screen.findByText(/Common labels/)).toBeInTheDocument();
    expect(await screen.findByText('exporter=OTLP')).toBeInTheDocument();
    expect(await screen.findByText('job=cicd-o11y/grafana-deployment-tools')).toBeInTheDocument();
  });

  it('renders collapsed common labels', async () => {
    const meta: LogsMetaItem[] = [
      {
        label: 'Common labels',
        value: {
          exporter: 'OTLP',
          job: 'cicd-o11y/grafana-deployment-tools',
          service_name: 'grafana',
          service_namespace: 'cicd-o11y',
        },
        kind: LogsMetaKind.LabelsMap,
      },
    ];
    setup({ meta });
    expect(await screen.findByText(/Common labels/)).toBeInTheDocument();
    expect(await screen.findByText('exporter=OTLP')).toBeInTheDocument();
    expect(await screen.findByText('job=cicd-o11y/grafana-deployment-tools')).toBeInTheDocument();
    expect(await screen.findByLabelText('Expand labels')).toBeInTheDocument();
  });

  it('renders expanded common labels', async () => {
    jest.spyOn(store, 'getBool').mockReturnValue(true);
    const meta: LogsMetaItem[] = [
      {
        label: 'Common labels',
        value: {
          exporter: 'OTLP',
          job: 'cicd-o11y/grafana-deployment-tools',
          service_name: 'grafana',
          service_namespace: 'cicd-o11y',
        },
        kind: LogsMetaKind.LabelsMap,
      },
    ];
    setup({ meta });
    expect(await screen.findByText(/Common labels/)).toBeInTheDocument();
    expect(await screen.findByText('exporter=OTLP')).toBeInTheDocument();
    expect(await screen.findByText('job=cicd-o11y/grafana-deployment-tools')).toBeInTheDocument();
    expect(await screen.findByLabelText('Collapse labels')).toBeInTheDocument();
  });
});
