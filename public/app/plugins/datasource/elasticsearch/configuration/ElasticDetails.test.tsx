import React from 'react';
import { last } from 'lodash';
import { mount } from 'enzyme';
import { ElasticDetails } from './ElasticDetails';
import { createDefaultConfigOptions } from './mocks';
import { Select } from '@grafana/ui';

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
    const selectEl = wrapper.find({ label: 'Pattern' }).find(Select);
    selectEl.props().onChange({ value: 'Daily', label: 'Daily' });

    expect(onChangeMock.mock.calls[0][0].jsonData.interval).toBe('Daily');
    expect(onChangeMock.mock.calls[0][0].database).toBe('[logstash-]YYYY.MM.DD');
  });

  it('should change database on interval change if pattern is from example', () => {
    const onChangeMock = jest.fn();
    const options = createDefaultConfigOptions();
    options.database = '[logstash-]YYYY.MM.DD.HH';
    const wrapper = mount(<ElasticDetails onChange={onChangeMock} value={options} />);

    const selectEl = wrapper.find({ label: 'Pattern' }).find(Select);
    selectEl.props().onChange({ value: 'Monthly', label: 'Monthly' });

    expect(onChangeMock.mock.calls[0][0].jsonData.interval).toBe('Monthly');
    expect(onChangeMock.mock.calls[0][0].database).toBe('[logstash-]YYYY.MM');
  });

  describe('version change', () => {
    const testCases = [
      { version: 50, expectedMaxConcurrentShardRequests: 256 },
      { version: 50, maxConcurrentShardRequests: 50, expectedMaxConcurrentShardRequests: 50 },
      { version: 56, expectedMaxConcurrentShardRequests: 256 },
      { version: 56, maxConcurrentShardRequests: 256, expectedMaxConcurrentShardRequests: 256 },
      { version: 56, maxConcurrentShardRequests: 5, expectedMaxConcurrentShardRequests: 256 },
      { version: 56, maxConcurrentShardRequests: 200, expectedMaxConcurrentShardRequests: 200 },
      { version: 70, expectedMaxConcurrentShardRequests: 5 },
      { version: 70, maxConcurrentShardRequests: 256, expectedMaxConcurrentShardRequests: 5 },
      { version: 70, maxConcurrentShardRequests: 5, expectedMaxConcurrentShardRequests: 5 },
      { version: 70, maxConcurrentShardRequests: 6, expectedMaxConcurrentShardRequests: 6 },
    ];

    const onChangeMock = jest.fn();
    const options = createDefaultConfigOptions();
    const wrapper = mount(<ElasticDetails onChange={onChangeMock} value={options} />);

    testCases.forEach(tc => {
      it(`sets maxConcurrentShardRequests = ${tc.maxConcurrentShardRequests} if version = ${tc.version},`, () => {
        wrapper.setProps({
          onChange: onChangeMock,
          value: {
            ...options,
            jsonData: {
              ...options.jsonData,
              maxConcurrentShardRequests: tc.maxConcurrentShardRequests,
            },
          },
        });

        const selectEl = wrapper.find({ label: 'Version' }).find(Select);
        selectEl.props().onChange({ value: tc.version, label: tc.version.toString() });

        expect(last(onChangeMock.mock.calls)[0].jsonData.maxConcurrentShardRequests).toBe(
          tc.expectedMaxConcurrentShardRequests
        );
      });
    });
  });
});
