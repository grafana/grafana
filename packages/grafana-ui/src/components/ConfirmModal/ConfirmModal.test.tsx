import React from 'react';
import { mount } from 'enzyme';
import { ConfirmModal } from './ConfirmModal';

describe('ConfirmModal', () => {
  it('renders without error', () => {
    mount(
      <ConfirmModal
        title="Some Title"
        body="Some Body"
        confirmText="Confirm"
        isOpen={true}
        onConfirm={() => {}}
        onDismiss={() => {}}
      />
    );
  });

  it('renders nothing by default or when isOpen is false', () => {
    const wrapper = mount(
      <ConfirmModal
        title="Some Title"
        body="Some Body"
        confirmText="Confirm"
        isOpen={false}
        onConfirm={() => {}}
        onDismiss={() => {}}
      />
    );
    expect(wrapper.html()).toBe('');

    wrapper.setProps({ ...wrapper.props(), isOpen: false });
    expect(wrapper.html()).toBe('');
  });

  it('renders correct contents', () => {
    const wrapper = mount(
      <ConfirmModal
        title="Some Title"
        body="Content"
        confirmText="Confirm"
        isOpen={true}
        onConfirm={() => {}}
        onDismiss={() => {}}
      />
    );

    expect(wrapper.contains('Some Title')).toBeTruthy();
    expect(wrapper.contains('Content')).toBeTruthy();
    expect(wrapper.contains('Confirm')).toBeTruthy();
  });
});
