import React from 'react';
import { mount } from 'enzyme';
import { ElasticDetails } from './ElasticDetails';
import { createDefaultConfigOptions } from './mocks';

describe('ElasticDetails', () => {
  it('should render without error', () => {
    mount(<ElasticDetails onChange={() => {}} value={createDefaultConfigOptions()} />);
  });

  it('should render "Max concurrent Shard Requests" if version high enough', () => {
    const wrapper = mount(<ElasticDetails onChange={() => {}} value={createDefaultConfigOptions()} />);
    expect(wrapper.find('input[aria-label="Max concurrent Shard Requests input"]').length).toBe(1);
  });

  it('should not render "Max concurrent Shard Requests" if version is low', () => {
    const options = createDefaultConfigOptions();
    options.jsonData.esVersion = 5;
    const wrapper = mount(<ElasticDetails onChange={() => {}} value={options} />);
    expect(wrapper.find('input[aria-label="Max concurrent Shard Requests input"]').length).toBe(0);
  });

  it('should change database on interval change when not set explicitly', () => {
    const onChangeMock = jest.fn();
    const wrapper = mount(<ElasticDetails onChange={onChangeMock} value={createDefaultConfigOptions()} />);
    const patternEl = wrapper.find('[aria-label="Pattern select"]');
    (patternEl.getDOMNode() as any).value = 'Daily';
    patternEl.simulate('change');

    expect(onChangeMock.mock.calls[0][0].jsonData.interval).toBe('Daily');
    expect(onChangeMock.mock.calls[0][0].database).toBe('[logstash-]YYYY.MM.DD');
  });

  it('should change database on interval change if pattern is from example', () => {
    const onChangeMock = jest.fn();
    const options = createDefaultConfigOptions();
    options.database = '[logstash-]YYYY.MM.DD.HH';
    const wrapper = mount(<ElasticDetails onChange={onChangeMock} value={options} />);

    const patternEl = wrapper.find('[aria-label="Pattern select"]');
    (patternEl.getDOMNode() as any).value = 'Monthly';
    patternEl.simulate('change');
    expect(onChangeMock.mock.calls[0][0].jsonData.interval).toBe('Monthly');
    expect(onChangeMock.mock.calls[0][0].database).toBe('[logstash-]YYYY.MM');
  });
});
