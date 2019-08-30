import React from 'react';
import { shallow } from 'enzyme';
import { QueryField } from './QueryField';

describe('<QueryField />', () => {
  it('should render with null initial value', () => {
    const wrapper = shallow(<QueryField initialQuery={null} />);
    expect(wrapper.find('div').exists()).toBeTruthy();
  });

  it('should render with empty initial value', () => {
    const wrapper = shallow(<QueryField initialQuery="" />);
    expect(wrapper.find('div').exists()).toBeTruthy();
  });

  it('should render with initial value', () => {
    const wrapper = shallow(<QueryField initialQuery="my query" />);
    expect(wrapper.find('div').exists()).toBeTruthy();
  });

  it('should execute query when enter is pressed and there are no suggestions visible', () => {
    const wrapper = shallow(<QueryField initialQuery="my query" />);
    const instance = wrapper.instance() as QueryField;
    instance.executeOnChangeAndRunQueries = jest.fn();
    const handleEnterAndTabKeySpy = jest.spyOn(instance, 'handleEnterAndTabKey');
    instance.onKeyDown({ key: 'Enter', preventDefault: () => {} } as KeyboardEvent, {});
    expect(handleEnterAndTabKeySpy).toBeCalled();
    expect(instance.executeOnChangeAndRunQueries).toBeCalled();
  });

  it('should copy selected text', () => {
    const wrapper = shallow(<QueryField initialQuery="" />);
    const instance = wrapper.instance() as QueryField;
    const textBlocks = ['ignore this text. copy this text'];
    const copiedText = instance.getCopiedText(textBlocks, 18, 32);

    expect(copiedText).toBe('copy this text');
  });

  it('should copy selected text across 2 lines', () => {
    const wrapper = shallow(<QueryField initialQuery="" />);
    const instance = wrapper.instance() as QueryField;
    const textBlocks = ['ignore this text. start copying here', 'lorem ipsum. stop copying here. lorem ipsum'];
    const copiedText = instance.getCopiedText(textBlocks, 18, 30);

    expect(copiedText).toBe('start copying here\nlorem ipsum. stop copying here');
  });

  it('should copy selected text across > 2 lines', () => {
    const wrapper = shallow(<QueryField initialQuery="" />);
    const instance = wrapper.instance() as QueryField;
    const textBlocks = [
      'ignore this text. start copying here',
      'lorem ipsum doler sit amet',
      'lorem ipsum. stop copying here. lorem ipsum',
    ];
    const copiedText = instance.getCopiedText(textBlocks, 18, 30);

    expect(copiedText).toBe('start copying here\nlorem ipsum doler sit amet\nlorem ipsum. stop copying here');
  });
});
