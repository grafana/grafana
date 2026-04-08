import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ComponentProps } from 'react';

import LogsNavigation from './LogsNavigation';

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

// we have to mock out reportInteraction, otherwise it crashes the test.
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: () => null,
}));

type LogsNavigationProps = ComponentProps<typeof LogsNavigation>;
const defaultProps: LogsNavigationProps = {
  logsSortOrder: undefined,
  scrollToTopLogs: jest.fn(),
};

const setup = (propOverrides?: Partial<LogsNavigationProps>) => {
  const props = {
    ...defaultProps,
    ...propOverrides,
  };

  return render(<LogsNavigation {...props} />);
};

describe('LogsNavigation', () => {
  beforeEach(() => {
    setBooleanFlags({ newLogsPanel: false });
  });

  it('should render scroll to top with default logs order', async () => {
    setup();

    expect(screen.getByTestId('scrollToTop')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('scrollToTop'));

    expect(defaultProps.scrollToTopLogs).toHaveBeenCalledTimes(1);
  });
});
