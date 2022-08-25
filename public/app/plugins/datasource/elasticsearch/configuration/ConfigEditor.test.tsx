import { mount, shallow } from 'enzyme';
import React from 'react';

import { DataSourceHttpSettings } from '@grafana/ui';

import { ConfigEditor } from './ConfigEditor';
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
    // @ts-ignore
    delete options.jsonData.esVersion;
    // @ts-ignore
    delete options.jsonData.timeField;
    delete options.jsonData.maxConcurrentShardRequests;

    expect.assertions(3);

    mount(
      <ConfigEditor
        onOptionsChange={(options) => {
          expect(options.jsonData.esVersion).toBe('5.0.0');
          expect(options.jsonData.timeField).toBe('@timestamp');
          expect(options.jsonData.maxConcurrentShardRequests).toBe(5);
        }}
        options={options}
      />
    );
  });

  it('should not apply default if values are set', () => {
    const onChange = jest.fn();

    mount(<ConfigEditor onOptionsChange={onChange} options={createDefaultConfigOptions()} />);

    expect(onChange).toHaveBeenCalledTimes(0);
  });
});
