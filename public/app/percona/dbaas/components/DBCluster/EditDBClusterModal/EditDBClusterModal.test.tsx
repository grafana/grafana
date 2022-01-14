import React from 'react';
import { mount } from 'enzyme';
import { EditDBClusterModal } from './EditDBClusterModal';
import { setVisibleStub, onDBClusterAddedStub } from './__mocks__/addDBClusterModalStubs';

jest.mock('app/core/app_events');

describe('EditDBClusterModal::', () => {
  it('should disable submit button when there are no changes', () => {
    const root = mount(
      <EditDBClusterModal isVisible setVisible={setVisibleStub} onDBClusterChanged={onDBClusterAddedStub} />
    );

    const button = root.find('[data-qa="dbcluster-update-cluster-button"]').find('button');

    expect(button.prop('disabled')).toBeTruthy();
  });
});
