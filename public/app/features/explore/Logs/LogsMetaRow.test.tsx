import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import saveAs from 'file-saver';
import { type ComponentProps } from 'react';

import { LogsDedupStrategy, type LogsMetaItem, LogsMetaKind, store } from '@grafana/data';

import { LogsMetaRow } from './LogsMetaRow';

const useBooleanFlagValueMock = jest.fn((_: string, defaultValue: boolean) => defaultValue);

const setBooleanFlags = (flags: Record<string, boolean>) => {
  useBooleanFlagValueMock.mockImplementation((flag: string, defaultValue: boolean) => {
    return Object.prototype.hasOwnProperty.call(flags, flag) ? flags[flag] : defaultValue;
  });
};

jest.mock('@openfeature/react-sdk', () => ({
  ...jest.requireActual('@openfeature/react-sdk'),
  useBooleanFlagValue: (flag: string, defaultValue: boolean) => useBooleanFlagValueMock(flag, defaultValue),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: () => null,
}));

type LogsMetaRowProps = ComponentProps<typeof LogsMetaRow>;
const defaultProps: LogsMetaRowProps = {
  meta: [],
  dedupStrategy: LogsDedupStrategy.none,
  dedupCount: 0,
  displayedFields: [],
  clearDisplayedFields: jest.fn(),
  defaultDisplayedFields: [],
  visualisationType: 'logs',
};

const setup = (propOverrides?: Partial<LogsMetaRowProps>) => {
  const props = {
    ...defaultProps,
    ...propOverrides,
  };

  return render(<LogsMetaRow {...props} />);
};

describe('LogsMetaRow', () => {
  beforeEach(() => {
    setBooleanFlags({
      logsPanelControls: false,
      newLogsPanel: false,
    });
  });

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

  it('does not render the show original line button if the current viz is the table', () => {
    setup({ displayedFields: ['test'], visualisationType: 'table' });
    expect(
      screen.queryByRole('button', {
        name: 'Show original line',
      })
    ).not.toBeInTheDocument();
  });

  it('renders the displayed fields', async () => {
    setup({ displayedFields: ['testField1234'] });
    expect(await screen.findByText('testField1234')).toBeInTheDocument();
  });

  it('renders a button to clear displayedfields', () => {
    const clearSpy = jest.fn();
    setup({ displayedFields: ['testField1234'], clearDisplayedFields: clearSpy });
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
