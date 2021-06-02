import React from 'react';
import { mount } from 'enzyme';
import { dataQa } from '@percona/platform-core';
import { DeleteModal } from './DeleteModal';

describe('DeleteModal', () => {
  it('should render modal', () => {
    const wrapper = mount(<DeleteModal setVisible={jest.fn()} onDelete={jest.fn()} isVisible />);

    expect(wrapper.find(dataQa('confirm-delete-modal-button'))).toBeTruthy();
    expect(wrapper.find(dataQa('cancel-delete-modal-button'))).toBeTruthy();
    expect(wrapper.find(dataQa('confirm-delete-modal-button')).contains('i')).toBeFalsy();
  });

  it('should render modal with custom message and title', () => {
    const wrapper = mount(
      <DeleteModal title="Test title" message="Test message" setVisible={jest.fn()} onDelete={jest.fn()} isVisible />
    );

    expect(wrapper.text().includes('Test title')).toBeTruthy();
    expect(wrapper.text().includes('Test message')).toBeTruthy();
  });

  it('should not render modal when visible is set to false', () => {
    const wrapper = mount(<DeleteModal setVisible={jest.fn()} onDelete={jest.fn()} isVisible={false} />);

    expect(wrapper.contains(dataQa('confirm-delete-modal-button'))).toBeFalsy();
    expect(wrapper.contains(dataQa('cancel-delete-modal-button'))).toBeFalsy();
  });

  it('should render spinner when loading', () => {
    const wrapper = mount(<DeleteModal setVisible={jest.fn()} onDelete={jest.fn()} isVisible loading />);

    expect(wrapper.find(dataQa('confirm-delete-modal-button')).find('i')).toBeTruthy();
  });

  it('should call setVisible on close', () => {
    const setVisible = jest.fn();
    const wrapper = mount(<DeleteModal setVisible={setVisible} onDelete={jest.fn()} isVisible />);

    wrapper.find(dataQa('modal-background')).simulate('click');

    expect(setVisible).toHaveBeenCalled();
  });

  it('should call onDelete on submit', async () => {
    const onDelete = jest.fn();
    const wrapper = mount(<DeleteModal setVisible={jest.fn()} onDelete={onDelete} isVisible />);
    console.log(wrapper.html());
    wrapper
      .find(dataQa('confirm-delete-modal-button'))
      .find('button')
      .simulate('click');

    expect(onDelete).toHaveBeenCalled();
  });

  it('should call setVisible on cancel', async () => {
    const setVisible = jest.fn();
    const wrapper = mount(<DeleteModal setVisible={setVisible} onDelete={jest.fn()} isVisible />);

    wrapper
      .find(dataQa('cancel-delete-modal-button'))
      .find('button')
      .simulate('click');

    expect(setVisible).toHaveBeenCalledWith(false);
  });
});
