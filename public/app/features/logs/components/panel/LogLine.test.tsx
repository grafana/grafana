import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createTheme } from '@grafana/data';

import { LOG_LINE_BODY_FIELD_NAME } from '../LogDetailsBody';
import { createLogLine } from '../__mocks__/logRow';

import { getStyles, LogLine } from './LogLine';
import { LogListModel } from './processing';

const theme = createTheme();
const styles = getStyles(theme);

describe('LogLine', () => {
  let log: LogListModel;
  beforeEach(() => {
    log = createLogLine({ labels: { place: 'luna' } });
  });

  test('Renders a log line', () => {
    render(
      <LogLine
        displayedFields={[]}
        index={0}
        log={log}
        showTime={true}
        style={{}}
        styles={styles}
        wrapLogMessage={false}
      />
    );
    expect(screen.getByText(log.timestamp)).toBeInTheDocument();
    expect(screen.getByText(log.body)).toBeInTheDocument();
  });

  test('Renders a log line with no timestamp', () => {
    render(
      <LogLine
        displayedFields={[]}
        index={0}
        log={log}
        showTime={false}
        style={{}}
        styles={styles}
        wrapLogMessage={false}
      />
    );
    expect(screen.queryByText(log.timestamp)).not.toBeInTheDocument();
    expect(screen.getByText(log.body)).toBeInTheDocument();
  });

  test('Renders a log line with displayed fields', () => {
    render(
      <LogLine
        displayedFields={['place']}
        index={0}
        log={log}
        showTime={true}
        style={{}}
        styles={styles}
        wrapLogMessage={false}
      />
    );
    expect(screen.getByText(log.timestamp)).toBeInTheDocument();
    expect(screen.queryByText(log.body)).not.toBeInTheDocument();
    expect(screen.getByText('luna')).toBeInTheDocument();
  });

  test('Renders a log line with body displayed fields', () => {
    render(
      <LogLine
        displayedFields={['place', LOG_LINE_BODY_FIELD_NAME]}
        index={0}
        log={log}
        showTime={true}
        style={{}}
        styles={styles}
        wrapLogMessage={false}
      />
    );
    expect(screen.getByText(log.timestamp)).toBeInTheDocument();
    expect(screen.getByText(log.body)).toBeInTheDocument();
    expect(screen.getByText('luna')).toBeInTheDocument();
  });

  describe('Log line menu', () => {
    test('Renders a log line menu', async () => {
      render(
        <LogLine
          displayedFields={[]}
          index={0}
          log={log}
          showTime={true}
          style={{}}
          styles={styles}
          wrapLogMessage={false}
        />
      );
      expect(screen.queryByText('Copy log line')).not.toBeInTheDocument();
      await userEvent.click(screen.getByLabelText('Log menu'));
      expect(screen.getByText('Copy log line')).toBeInTheDocument();
    });
  });
});
