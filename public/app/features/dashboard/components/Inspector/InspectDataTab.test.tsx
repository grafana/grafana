import React from 'react';
import { InspectDataTab } from './InspectDataTab';
import { shallow } from 'enzyme';
import { DataFrame, PanelModel, DataTransformerID } from '@grafana/data';

const mockPanel: any = {
  title: 'My panel',
  id: 1,
  options: {},
  fieldConfig: {
    defaults: {},
    overrides: [],
  },
};

const mockDataFrames: DataFrame[] = [];

describe('InspectDataTab', () => {
  describe('should generate string with applied transforms and overrides ', () => {
    it('no filters', () => {
      const options = { withTransforms: false, withFieldConfig: false };
      const wrapper = shallow<InspectDataTab>(
        <InspectDataTab
          options={options}
          onOptionsChange={() => {}}
          isLoading={false}
          panel={mockPanel as any}
          data={mockDataFrames}
        />
      );
      expect(wrapper.instance().getActiveString()).toBe(DataTransformerID.seriesToColumns);
    });
  });
});
