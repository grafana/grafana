import React from 'react';
import { mount } from 'enzyme';
import { Modal } from './Modal';

describe('Modal', () => {
  it('renders without error', () => {
    mount(<Modal title={'Some Title'} isOpen={true} />);
  });

  it('renders nothing by default or when isOpen is false', () => {
    const wrapper = mount(<Modal title={'Some Title'} />);
    expect(wrapper.html()).toBe('');

    wrapper.setProps({ ...wrapper.props(), isOpen: false });
    expect(wrapper.html()).toBe('');
  });

  it('renders correct contents', () => {
    const wrapper = mount(
      <Modal title={'Some Title'} isOpen={true}>
        <div id={'modal-content'}>Content</div>
      </Modal>
    );
    expect(wrapper.find('div#modal-content').length).toBe(1);
    expect(wrapper.contains('Some Title')).toBeTruthy();
  });
});
