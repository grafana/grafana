import { render, screen } from '@testing-library/react';
import React from 'react';

import { DataSourceInstanceSettings, DataSourcePluginMeta } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { setDataSourceSrv } from '@grafana/runtime';

import { DerivedField } from './DerivedField';

const mockList = jest.fn();

describe('DerivedField', () => {
  beforeEach(() => {
    setDataSourceSrv({
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
    render(<DerivedField value={value} onChange={() => {}} onDelete={() => {}} suggestions={[]} />);
    expect(await screen.findByText('Name')).toBeInTheDocument();

    expect(screen.getByLabelText(selectors.components.DataSourcePicker.inputV2)).toBeInTheDocument();
  });

  it('shows url link if uid is not set', async () => {
    const value = {
      matcherRegex: '',
      name: '',
      url: 'test',
    };
    // Render and wait for the Name field to be visible
    // using findBy to wait for asynchronous operations to complete
    render(<DerivedField value={value} onChange={() => {}} onDelete={() => {}} suggestions={[]} />);
    expect(await screen.findByText('Name')).toBeInTheDocument();

    expect(screen.queryByLabelText(selectors.components.DataSourcePicker.inputV2)).not.toBeInTheDocument();
  });

  it('shows only tracing datasources for internal link', async () => {
    const value = {
      matcherRegex: '',
      name: '',
      datasourceUid: 'test',
    };
    // Render and wait for the Name field to be visible
    // using findBy to wait for asynchronous operations to complete
    render(<DerivedField value={value} onChange={() => {}} onDelete={() => {}} suggestions={[]} />);
    expect(await screen.findByText('Name')).toBeInTheDocument();
    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({
        tracing: true,
      })
    );
  });
});
