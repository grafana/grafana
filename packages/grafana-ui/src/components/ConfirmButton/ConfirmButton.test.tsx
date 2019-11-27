import React from 'react';
import { ConfirmButton } from './ConfirmButton';
import { mount, ShallowWrapper } from 'enzyme';
import { Button } from '../Button/Button';

describe('ConfirmButton', () => {
  let wrapper: any;
  let deleted: any;

  beforeAll(() => {
    deleted = false;

    function deleteItem() {
      deleted = true;
    }

    wrapper = mount(
      <ConfirmButton confirmText="Confirm delete" onConfirm={() => deleteItem()}>
        Delete
      </ConfirmButton>
    );
  });

  it('should show confirm delete when clicked', () => {
    expect(deleted).toBe(false);
    wrapper
      .find(Button)
      .findWhere((n: ShallowWrapper) => {
        return n.text() === 'Confirm delete' && n.type() === Button;
      })
      .simulate('click');
    expect(deleted).toBe(true);
  });
});
