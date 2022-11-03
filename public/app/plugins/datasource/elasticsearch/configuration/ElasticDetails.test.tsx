import { render, screen } from '@testing-library/react';
import React from 'react';
import selectEvent from 'react-select-event';

import { ElasticDetails } from './ElasticDetails';
import { createDefaultConfigOptions } from './mocks';

describe('ElasticDetails', () => {
  describe('Max concurrent Shard Requests', () => {
    it('should render "Max concurrent Shard Requests" ', () => {
      render(<ElasticDetails onChange={() => {}} value={createDefaultConfigOptions({ esVersion: '8.2.0' })} />);
      expect(screen.getByLabelText('Max concurrent Shard Requests')).toBeInTheDocument();
    });
  });

  it('should change database on interval change when not set explicitly', async () => {
    const onChangeMock = jest.fn();
    render(<ElasticDetails onChange={onChangeMock} value={createDefaultConfigOptions()} />);
    const selectEl = screen.getByLabelText('Pattern');

    await selectEvent.select(selectEl, 'Daily', { container: document.body });

    expect(onChangeMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        database: '[logstash-]YYYY.MM.DD',
        jsonData: expect.objectContaining({ interval: 'Daily' }),
      })
    );
  });

  it('should change database on interval change if pattern is from example', async () => {
    const onChangeMock = jest.fn();
    const options = createDefaultConfigOptions();
    options.database = '[logstash-]YYYY.MM.DD.HH';
    render(<ElasticDetails onChange={onChangeMock} value={options} />);
    const selectEl = screen.getByLabelText('Pattern');

    await selectEvent.select(selectEl, 'Monthly', { container: document.body });

    expect(onChangeMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        database: '[logstash-]YYYY.MM',
        jsonData: expect.objectContaining({ interval: 'Monthly' }),
      })
    );
  });

  describe('version change', () => {
    const tc = { version: '7.10+', maxConcurrentShardRequests: 6, expectedMaxConcurrentShardRequests: 6 };

    const onChangeMock = jest.fn();
    it(`sets maxConcurrentShardRequests=${tc.expectedMaxConcurrentShardRequests} if version=${tc.version},`, async () => {
      render(
        <ElasticDetails
          onChange={onChangeMock}
          value={createDefaultConfigOptions({
            maxConcurrentShardRequests: tc.maxConcurrentShardRequests,
            esVersion: '7.0.0',
          })}
        />
      );

      const selectEl = screen.getByLabelText('ElasticSearch version');

      await selectEvent.select(selectEl, tc.version, { container: document.body });

      expect(onChangeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          jsonData: expect.objectContaining({ maxConcurrentShardRequests: tc.expectedMaxConcurrentShardRequests }),
        })
      );
    });
  });
});
