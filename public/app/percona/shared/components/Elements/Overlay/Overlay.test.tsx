import React from 'react';
import { mount } from 'enzyme';
import { Overlay } from './Overlay';

describe('Overlay::', () => {
  it('Renders children correctly', () => {
    const root = mount(
      <Overlay isPending={false}>
        <p>Child 1</p>
        <p>Child 2</p>
      </Overlay>
    );
    const wrapper = root.find('[data-qa="pmm-overlay-wrapper"]');

    expect(wrapper.children().length).toEqual(2);
  });

  it('Renders overlay and spinner while pending', () => {
    const root = mount(
      <Overlay isPending>
        <p>Test</p>
      </Overlay>
    );
    const wrapper = root.find('[data-qa="pmm-overlay-wrapper"]');

    expect(wrapper.children().length).toBe(2);
    expect(wrapper.childAt(0).find('i')).toBeTruthy();
  });

  it('Doesnt render overlay if not pending', () => {
    const root = mount(
      <Overlay isPending={false}>
        <p>Test</p>
      </Overlay>
    );

    expect(root.find('i').exists()).toBeFalsy();
  });
});
