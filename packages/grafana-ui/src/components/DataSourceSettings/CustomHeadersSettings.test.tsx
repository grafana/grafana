import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CustomHeadersSettings, Props } from './CustomHeadersSettings';

const setup = (propOverrides?: object) => {
  const onChange = jest.fn();
  const props: Props = {
    dataSourceConfig: {
      id: 4,
      uid: 'x',
      orgId: 1,
      name: 'gdev-influxdb',
      type: 'influxdb',
      typeName: 'Influxdb',
      typeLogoUrl: '',
      access: 'direct',
      url: 'http://localhost:8086',
      user: 'grafana',
      database: 'site',
      basicAuth: false,
      basicAuthUser: '',
      withCredentials: false,
      isDefault: false,
      jsonData: {
        timeInterval: '15s',
        httpMode: 'GET',
        keepCookies: ['cookie1', 'cookie2'],
      },
      secureJsonData: {
        password: true,
      },
      secureJsonFields: {},
      readOnly: false,
    },
    onChange,
    ...propOverrides,
  };

  render(<CustomHeadersSettings {...props} />);
  return { onChange };
};

function assertRowCount(configuredInputCount: number, passwordInputCount: number) {
  const inputs = screen.queryAllByPlaceholderText('X-Custom-Header');
  const passwordInputs = screen.queryAllByPlaceholderText('Header Value');
  const configuredInputs = screen.queryAllByDisplayValue('configured');
  expect(inputs.length).toBe(passwordInputs.length + configuredInputs.length);

  expect(passwordInputs).toHaveLength(passwordInputCount);
  expect(configuredInputs).toHaveLength(configuredInputCount);
}

describe('Render', () => {
  it('should add a new header', async () => {
    setup();
    const b = screen.getByRole('button', { name: 'Add header' });
    expect(b).toBeInTheDocument();
    assertRowCount(0, 0);

    await userEvent.click(b);
    assertRowCount(0, 1);
  });

  it('add header button should not submit the form', () => {
    setup();
    const b = screen.getByRole('button', { name: 'Add header' });
    expect(b).toBeInTheDocument();
    expect(b).toHaveAttribute('type', 'button');
  });

  it('should remove a header', async () => {
    const { onChange } = setup({
      dataSourceConfig: {
        jsonData: {
          httpHeaderName1: 'X-Custom-Header',
        },
        secureJsonFields: {
          httpHeaderValue1: true,
        },
      },
    });
    const b = screen.getByRole('button', { name: 'Remove header' });
    expect(b).toBeInTheDocument();

    assertRowCount(1, 0);

    await userEvent.click(b);
    assertRowCount(0, 0);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].jsonData).toStrictEqual({});
  });

  it('when removing a just-created header, it should clean up secureJsonData', async () => {
    const { onChange } = setup({
      dataSourceConfig: {
        jsonData: {
          httpHeaderName1: 'name1',
        },
        secureJsonData: {
          httpHeaderValue1: 'value1',
        },
      },
    });

    // we remove the row
    const removeButton = screen.getByRole('button', { name: 'Remove header' });
    expect(removeButton).toBeInTheDocument();
    await userEvent.click(removeButton);
    assertRowCount(0, 0);
    expect(onChange).toHaveBeenCalled();

    // and we verify the onChange-data
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
    expect(lastCall[0].jsonData).not.toHaveProperty('httpHeaderName1');
    expect(lastCall[0].secureJsonData).not.toHaveProperty('httpHeaderValue1');
  });

  it('should reset a header', async () => {
    setup({
      dataSourceConfig: {
        jsonData: {
          httpHeaderName1: 'X-Custom-Header',
        },
        secureJsonFields: {
          httpHeaderValue1: true,
        },
      },
    });

    const b = screen.getByRole('button', { name: 'Reset' });
    expect(b).toBeInTheDocument();

    assertRowCount(1, 0);
    await userEvent.click(b);
    assertRowCount(0, 1);
  });
});
