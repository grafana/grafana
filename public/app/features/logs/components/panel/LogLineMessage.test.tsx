import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createTheme } from '@grafana/data';

import { getStyles } from './LogLine';
import { LogLineMessage } from './LogLineMessage';

const theme = createTheme();
const styles = getStyles(theme);

describe('LogLineMessage', () => {
  test('Renders a log line message', () => {
    render(
      <LogLineMessage style={{}} styles={styles}>
        Message
      </LogLineMessage>
    );
    expect(screen.getByText('Message')).toBeInTheDocument();
  });

  test('Renders a button with the message', async () => {
    const handleClick = jest.fn();
    render(
      <LogLineMessage style={{}} styles={styles} onClick={handleClick}>
        Message
      </LogLineMessage>
    );
    await userEvent.click(screen.getByText('Message'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
