import { render, screen } from '@testing-library/react';
import selectEvent from 'react-select-event';

import { ElasticDetails } from './ElasticDetails';
import { createDefaultConfigOptions } from './__mocks__/configOptions';

describe('ElasticDetails', () => {
  describe('Max concurrent Shard Requests', () => {
    it('should render "Max concurrent Shard Requests" ', () => {
      render(<ElasticDetails onChange={() => {}} value={createDefaultConfigOptions()} />);
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
        jsonData: expect.objectContaining({ interval: 'Daily', index: '[logstash-]YYYY.MM.DD' }),
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
        jsonData: expect.objectContaining({ interval: 'Monthly', index: '[logstash-]YYYY.MM' }),
      })
    );
  });
});
