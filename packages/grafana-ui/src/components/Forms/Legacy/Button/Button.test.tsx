import React from 'react';
import { Button, LinkButton } from './Button';
import { mount } from 'enzyme';

describe('Button', () => {
  it('renders correct html', () => {
    const wrapper = mount(<Button icon={'fa fa-plus'}>Click me</Button>);
    expect(wrapper.html()).toMatchSnapshot();
  });
});

describe('LinkButton', () => {
  it('renders correct html', () => {
    const wrapper = mount(<LinkButton icon={'fa fa-plus'}>Click me</LinkButton>);
    expect(wrapper.html()).toMatchSnapshot();
  });

  it('allows a disable state on link button', () => {
    const wrapper = mount(
      <LinkButton disabled icon={'fa fa-plus'}>
        Click me
      </LinkButton>
    );
    expect(wrapper.find('a[disabled]').length).toBe(1);
  });
});
