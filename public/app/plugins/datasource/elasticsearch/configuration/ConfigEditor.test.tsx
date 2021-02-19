import React from 'react';
import { mount, shallow } from 'enzyme';
import { ConfigEditor } from './ConfigEditor';
import { DataSourceHttpSettings } from '@grafana/ui';
import { ElasticDetails } from './ElasticDetails';
import { LogsConfig } from './LogsConfig';
import { createDefaultConfigOptions } from './mocks';

describe('ConfigEditor', () => {
  it('should render without error', () => {
    mount(<ConfigEditor onOptionsChange={() => {}} options={createDefaultConfigOptions()} />);
  });

  it('should render all parts of the config', () => {
    const wrapper = shallow(<ConfigEditor onOptionsChange={() => {}} options={createDefaultConfigOptions()} />);
    expect(wrapper.find(DataSourceHttpSettings).length).toBe(1);
    expect(wrapper.find(ElasticDetails).length).toBe(1);
    expect(wrapper.find(LogsConfig).length).toBe(1);
  });

  it('should set defaults', () => {
    const options = createDefaultConfigOptions();
    delete options.jsonData.esVersion;
    delete options.jsonData.timeField;
    delete options.jsonData.maxConcurrentShardRequests;

    expect.assertions(3);

    mount(
      <ConfigEditor
        onOptionsChange={options => {
          expect(options.jsonData.esVersion).toBe(5);
          expect(options.jsonData.timeField).toBe('@timestamp');
          expect(options.jsonData.maxConcurrentShardRequests).toBe(256);
        }}
        options={options}
      />
    );
  });

  it('should not apply default if values are set', () => {
    expect.assertions(3);

    mount(
      <ConfigEditor
        onOptionsChange={options => {
          expect(options.jsonData.esVersion).toBe(70);
          expect(options.jsonData.timeField).toBe('@time');
          expect(options.jsonData.maxConcurrentShardRequests).toBe(300);
        }}
        options={createDefaultConfigOptions()}
      />
    );
  });
});
