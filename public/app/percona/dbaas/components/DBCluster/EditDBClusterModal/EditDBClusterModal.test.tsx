import React from 'react';
import { mount } from 'enzyme';
import { dataQa } from '@percona/platform-core';
import { EditDBClusterModal } from './EditDBClusterModal';
import { setVisibleStub, onDBClusterAddedStub } from './__mocks__/addDBClusterModalStubs';
import { dbClustersStub } from '../__mocks__/dbClustersStubs';

jest.mock('app/core/app_events');

describe('EditDBClusterModal::', () => {
  it('should render advanced options', () => {
    const root = mount(
      <EditDBClusterModal
        isVisible
        setVisible={setVisibleStub}
        onDBClusterChanged={onDBClusterAddedStub}
        selectedCluster={dbClustersStub[0]}
      />
    );

    expect(root.find(dataQa('resources-radio-button'))).toBeTruthy();
    expect(root.find(dataQa('memory-field-container'))).toBeTruthy();
    expect(root.find(dataQa('cpu-field-container'))).toBeTruthy();
    expect(root.find(dataQa('disk-field-container'))).toBeTruthy();
    expect(root.find(dataQa('disk-number-input')).prop('disabled')).toBeTruthy();
    expect(root.find(dataQa('resources-bar'))).toBeTruthy();
  });
});
