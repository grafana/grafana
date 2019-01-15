import React from 'react';
import { DeleteButton } from './DeleteButton';
import { shallow, ShallowWrapper } from 'enzyme';

describe('DeleteButton', () => {
  let wrapper: ShallowWrapper<any, any>;
  let deleted: any;

  beforeAll(() => {
    deleted = false;

    function deleteItem() {
      deleted = true;
    }

    wrapper = shallow(<DeleteButton onConfirm={() => deleteItem()} />);
  });

  it('should show confirm delete when clicked', () => {
    expect(wrapper.state().showConfirm).toBe(false);
    wrapper.find('[data-test-id="deleteButton"]').simulate('click');
    expect(wrapper.state().showConfirm).toBe(true);
  });

  it.only('should hide confirm delete when clicked', () => {
    wrapper.find('[data-test-id="deleteButton"]').simulate('click');
    expect(wrapper.state().showConfirm).toBe(true);
    wrapper.find('[data-test-id="cancelDeleteButton"]').simulate('click');
    expect(wrapper.state().showConfirm).toBe(false);
  });

  it('should show confirm delete when clicked', () => {
    expect(deleted).toBe(false);
    wrapper.find('[data-test-id="confirmDeleteButton"]').simulate('click');
    expect(deleted).toBe(true);
  });
});
