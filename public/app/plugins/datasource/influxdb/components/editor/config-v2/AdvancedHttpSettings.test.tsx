import { render, screen, fireEvent } from '@testing-library/react';

import { AdvancedHttpSettings } from './AdvancedHttpSettings';
import { createTestProps } from './helpers';

describe('AdvancedHttpSettings', () => {
  const onOptionsChangeMock = jest.fn();

  const defaultProps = createTestProps({
    options: {},
    mocks: {
      onOptionsChange: onOptionsChangeMock,
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders toggle and toggles section visibility', () => {
    render(<AdvancedHttpSettings {...defaultProps} />);

    const toggle = screen.getByTestId('influxdb-v2-config-advanced-http-settings-toggle');
    expect(toggle).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.getByLabelText('Timeout in seconds')).toBeInTheDocument();
  });

  it('calls onOptionsChange when timeout is changed', () => {
    const props = {
      ...defaultProps,
      options: {
        ...defaultProps.options,
        jsonData: {
          ...defaultProps.options.jsonData,
          timeout: 10,
          keepCookies: [],
        },
      },
    };

    render(<AdvancedHttpSettings {...props} />);

    const input = screen.getByLabelText('Timeout in seconds');
    fireEvent.change(input, { target: { value: '20' } });
    expect(props.onOptionsChange).toHaveBeenCalled();
  });

  it('calls onOptionsChange when allowed cookies are changed', () => {
    const props = {
      ...defaultProps,
      options: {
        ...defaultProps.options,
        jsonData: {
          ...defaultProps.options.jsonData,
          timeout: 10,
          keepCookies: ['session'],
        },
      },
    };

    render(<AdvancedHttpSettings {...props} />);

    const cookieInput = screen.getByPlaceholderText('New cookie (hit enter to add)');
    fireEvent.change(cookieInput, { target: { value: 'auth' } });
    fireEvent.keyDown(cookieInput, { key: 'Enter', code: 'Enter' });

    expect(props.onOptionsChange).toHaveBeenCalled();
  });
});
