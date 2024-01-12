import { render, screen } from '@testing-library/react';
import React from 'react';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';

import { DateHistogram } from 'app/plugins/datasource/elasticsearch/types';

import { useDispatch } from '../../../../hooks/useStatelessReducer';

import { DateHistogramSettingsEditor } from './DateHistogramSettingsEditor';

jest.mock('../../../../hooks/useStatelessReducer');

describe('DateHistogramSettingsEditor', () => {
  test('Renders the date histogram selector', async () => {
    const bucketAgg: DateHistogram = {
      field: '@timestamp',
      id: '2',
      settings: { interval: 'auto' },
      type: 'date_histogram',
    };
    render(<DateHistogramSettingsEditor bucketAgg={bucketAgg} />);
    expect(await screen.findByText('Fixed interval')).toBeInTheDocument();
    expect(await screen.findByText('auto')).toBeInTheDocument();
  });
  test('Renders the date histogram selector with a fixed interval', async () => {
    const bucketAgg: DateHistogram = {
      field: '@timestamp',
      id: '2',
      settings: { interval: '10s' },
      type: 'date_histogram',
    };
    render(<DateHistogramSettingsEditor bucketAgg={bucketAgg} />);
    expect(await screen.findByText('Fixed interval')).toBeInTheDocument();
    expect(await screen.findByText('10s')).toBeInTheDocument();
  });
  test('Renders the date histogram selector with a calendar interval', async () => {
    const bucketAgg: DateHistogram = {
      field: '@timestamp',
      id: '2',
      settings: { interval: '1w' },
      type: 'date_histogram',
    };
    render(<DateHistogramSettingsEditor bucketAgg={bucketAgg} />);
    expect(await screen.findByText('Calendar interval')).toBeInTheDocument();
    expect(await screen.findByText('1w')).toBeInTheDocument();
  });

  describe('Handling change', () => {
    let dispatch = jest.fn();
    beforeEach(() => {
      dispatch.mockClear();
      jest.mocked(useDispatch).mockReturnValue(dispatch);
    });
    test('Handles changing from calendar to fixed interval type', async () => {
      const bucketAgg: DateHistogram = {
        field: '@timestamp',
        id: '2',
        settings: { interval: '1w' },
        type: 'date_histogram',
      };
      render(<DateHistogramSettingsEditor bucketAgg={bucketAgg} />);

      expect(await screen.findByText('Calendar interval')).toBeInTheDocument();
      expect(await screen.findByText('1w')).toBeInTheDocument();

      await selectOptionInTest(screen.getByLabelText('Calendar interval'), '10s');

      expect(dispatch).toHaveBeenCalledTimes(1);
    });
    test('Renders the date histogram selector with a calendar interval', async () => {
      const bucketAgg: DateHistogram = {
        field: '@timestamp',
        id: '2',
        settings: { interval: '1m' },
        type: 'date_histogram',
      };
      render(<DateHistogramSettingsEditor bucketAgg={bucketAgg} />);

      expect(await screen.findByText('Fixed interval')).toBeInTheDocument();
      expect(await screen.findByText('1m')).toBeInTheDocument();

      await selectOptionInTest(screen.getByLabelText('Fixed interval'), '1q');

      expect(dispatch).toHaveBeenCalledTimes(1);
    });
  });
});
