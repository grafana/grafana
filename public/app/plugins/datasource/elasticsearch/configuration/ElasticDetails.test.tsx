import React from 'react';
import { ElasticDetails } from './ElasticDetails';
import { createDefaultConfigOptions } from './mocks';
import { render, screen } from '@testing-library/react';
import selectEvent from 'react-select-event';

describe('ElasticDetails', () => {
  describe('Max concurrent Shard Requests', () => {
    it('should render "Max concurrent Shard Requests" if version >= 5.6.0', () => {
      render(<ElasticDetails onChange={() => {}} value={createDefaultConfigOptions({ esVersion: '5.6.0' })} />);
      expect(screen.getByLabelText('Max concurrent Shard Requests')).toBeInTheDocument();
    });

    it('should not render "Max concurrent Shard Requests" if version < 5.6.0', () => {
      render(<ElasticDetails onChange={() => {}} value={createDefaultConfigOptions({ esVersion: '5.0.0' })} />);
      expect(screen.queryByLabelText('Max concurrent Shard Requests')).not.toBeInTheDocument();
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
    const testCases = [
      { version: '5.x', expectedMaxConcurrentShardRequests: 256 },
      { version: '5.x', maxConcurrentShardRequests: 50, expectedMaxConcurrentShardRequests: 50 },
      { version: '5.6+', expectedMaxConcurrentShardRequests: 256 },
      { version: '5.6+', maxConcurrentShardRequests: 256, expectedMaxConcurrentShardRequests: 256 },
      { version: '5.6+', maxConcurrentShardRequests: 5, expectedMaxConcurrentShardRequests: 256 },
      { version: '5.6+', maxConcurrentShardRequests: 200, expectedMaxConcurrentShardRequests: 200 },
      { version: '7.0+', expectedMaxConcurrentShardRequests: 5 },
      { version: '7.0+', maxConcurrentShardRequests: 256, expectedMaxConcurrentShardRequests: 5 },
      { version: '7.0+', maxConcurrentShardRequests: 5, expectedMaxConcurrentShardRequests: 5 },
      { version: '7.0+', maxConcurrentShardRequests: 6, expectedMaxConcurrentShardRequests: 6 },
    ];

    testCases.forEach((tc) => {
      const onChangeMock = jest.fn();
      it(`sets maxConcurrentShardRequests=${tc.expectedMaxConcurrentShardRequests} if version=${tc.version},`, async () => {
        render(
          <ElasticDetails
            onChange={onChangeMock}
            value={createDefaultConfigOptions({
              maxConcurrentShardRequests: tc.maxConcurrentShardRequests,
              esVersion: '2.0.0',
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
});
