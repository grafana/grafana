import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DataSourceInstanceSettings, DataSourcePluginMeta } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { setDataSourceSrv } from '@grafana/runtime';

import { DerivedField } from './DerivedField';

const mockList = jest.fn();
const validateMock = jest.fn();

describe('DerivedField', () => {
  beforeEach(() => {
    setDataSourceSrv({
      registerRuntimeDataSource: jest.fn(),
      get: jest.fn(),
      reload: jest.fn(),
      getInstanceSettings: jest.fn(),
      getList: mockList.mockImplementation(() => [
        {
          id: 1,
          uid: 'metrics',
          name: 'metrics_ds',
          meta: {
            tracing: false,
            info: {
              logos: {
                small: '',
              },
            },
          } as DataSourcePluginMeta,
        } as DataSourceInstanceSettings,
        {
          id: 2,
          uid: 'tracing',
          name: 'tracing_ds',
          meta: {
            tracing: true,
            info: {
              logos: {
                small: '',
              },
            },
          } as DataSourcePluginMeta,
        } as DataSourceInstanceSettings,
      ]),
    });
  });

  it('shows internal link if uid is set', async () => {
    const value = {
      matcherRegex: '',
      name: '',
      datasourceUid: 'test',
    };
    // Render and wait for the Name field to be visible
    // using findBy to wait for asynchronous operations to complete
    render(
      <DerivedField
        validateName={validateMock}
        value={value}
        onChange={() => {}}
        onDelete={() => {}}
        suggestions={[]}
      />
    );
    expect(await screen.findByText('Name')).toBeInTheDocument();

    expect(screen.getByTestId(selectors.components.DataSourcePicker.container)).toBeInTheDocument();
  });

  it('shows url link if uid is not set', async () => {
    const value = {
      matcherRegex: '',
      name: '',
      url: 'test',
    };
    // Render and wait for the Name field to be visible
    // using findBy to wait for asynchronous operations to complete
    render(
      <DerivedField
        validateName={validateMock}
        value={value}
        onChange={() => {}}
        onDelete={() => {}}
        suggestions={[]}
      />
    );
    expect(await screen.findByText('Name')).toBeInTheDocument();

    expect(await screen.queryByTestId(selectors.components.DataSourcePicker.container)).not.toBeInTheDocument();
  });

  it('shows only tracing datasources for internal link', async () => {
    const value = {
      matcherRegex: '',
      name: '',
      datasourceUid: 'test',
    };
    // Render and wait for the Name field to be visible
    // using findBy to wait for asynchronous operations to complete
    render(
      <DerivedField
        validateName={validateMock}
        value={value}
        onChange={() => {}}
        onDelete={() => {}}
        suggestions={[]}
      />
    );
    expect(await screen.findByText('Name')).toBeInTheDocument();
    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({
        tracing: true,
      })
    );
  });

  it('validates the field name', async () => {
    const value = {
      matcherRegex: '',
      name: 'field-name',
      datasourceUid: 'test',
    };
    const validate = jest.fn().mockReturnValue(false);
    render(
      <DerivedField validateName={validate} value={value} onChange={() => {}} onDelete={() => {}} suggestions={[]} />
    );
    userEvent.click(await screen.findByDisplayValue(value.name));

    expect(await screen.findByText('The name is already in use')).toBeInTheDocument();
  });
});
