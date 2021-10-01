import React from 'react';
import { mount } from 'enzyme';
import { CheckboxField, dataTestId } from '@percona/platform-core';
import { DeleteModal } from './DeleteModal';

xdescribe('DeleteModal', () => {
  it('should render modal', () => {
    const wrapper = mount(<DeleteModal setVisible={jest.fn()} onDelete={jest.fn()} isVisible />);

    expect(wrapper.find(dataTestId('confirm-delete-modal-button'))).toBeTruthy();
    expect(wrapper.find(dataTestId('cancel-delete-modal-button'))).toBeTruthy();
    expect(wrapper.find(dataTestId('confirm-delete-modal-button')).contains('i')).toBeFalsy();
    expect(wrapper.find(dataTestId('force-checkbox-field')).exists()).toBeFalsy();
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

    expect(wrapper.contains(dataTestId('confirm-delete-modal-button'))).toBeFalsy();
    expect(wrapper.contains(dataTestId('cancel-delete-modal-button'))).toBeFalsy();
  });

  it('should render spinner when loading', () => {
    const wrapper = mount(<DeleteModal setVisible={jest.fn()} onDelete={jest.fn()} isVisible loading />);

    expect(wrapper.find(dataTestId('confirm-delete-modal-button')).find('i')).toBeTruthy();
  });

  it('should call setVisible on close', () => {
    const setVisible = jest.fn();
    const wrapper = mount(<DeleteModal setVisible={setVisible} onDelete={jest.fn()} isVisible />);

    wrapper.find(dataTestId('modal-background')).simulate('click');

    expect(setVisible).toHaveBeenCalled();
  });

  it('should call onDelete on submit', async () => {
    const onDelete = jest.fn();
    const wrapper = mount(<DeleteModal setVisible={jest.fn()} onDelete={onDelete} isVisible />);

    wrapper.find(dataTestId('confirm-delete-modal-button')).find('button').simulate('submit');

    expect(onDelete).toHaveBeenCalled();
  });

  it('should call setVisible on cancel', async () => {
    const setVisible = jest.fn();
    const wrapper = mount(<DeleteModal setVisible={setVisible} onDelete={jest.fn()} isVisible />);

    wrapper.find(dataTestId('cancel-delete-modal-button')).find('button').simulate('click');

    expect(setVisible).toHaveBeenCalledWith(false);
  });

  it('should render children if any', () => {
    const Dummy = () => <></>;
    const wrapper = mount(
      <DeleteModal setVisible={jest.fn()} onDelete={jest.fn()} isVisible>
        <Dummy />
      </DeleteModal>
    );
    expect(wrapper.find(Dummy).exists()).toBeTruthy();
  });

  it('should render the force checkbox', () => {
    const wrapper = mount(<DeleteModal setVisible={jest.fn()} onDelete={jest.fn()} isVisible showForce />);
    expect(wrapper.find(dataTestId('force-checkbox-input')).exists()).toBeTruthy();
  });

  it('should show the checkbox label', () => {
    const wrapper = mount(
      <DeleteModal setVisible={jest.fn()} onDelete={jest.fn()} isVisible showForce forceLabel="force this" />
    );
    expect(wrapper.find(CheckboxField).text()).toBe('force this');
  });
});
