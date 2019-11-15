import React from 'react';
import { ConfirmButton } from './ConfirmButton';
import { shallow } from 'enzyme';

describe('ConfirmButton', () => {
  let wrapper: any;
  let deleted: any;

  beforeAll(() => {
    deleted = false;

    function deleteItem() {
      deleted = true;
    }

    wrapper = shallow(<ConfirmButton onConfirm={() => deleteItem()} />);
  });

  it('should show confirm delete when clicked', () => {
    expect(wrapper.state().showConfirm).toBe(false);
    wrapper.find('.delete-button').simulate('click');
    expect(wrapper.state().showConfirm).toBe(true);
  });

  it('should hide confirm delete when clicked', () => {
    wrapper.find('.delete-button').simulate('click');
    expect(wrapper.state().showConfirm).toBe(true);
    wrapper
      .find('.confirm-delete')
      .find('.btn')
      .at(0)
      .simulate('click');
    expect(wrapper.state().showConfirm).toBe(false);
  });

  it('should show confirm delete when clicked', () => {
    expect(deleted).toBe(false);
    wrapper
      .find('.confirm-delete')
      .find('.btn')
      .at(1)
      .simulate('click');
    expect(deleted).toBe(true);
  });
});
