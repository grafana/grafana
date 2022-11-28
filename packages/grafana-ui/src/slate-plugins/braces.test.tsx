import { shallow } from 'enzyme';
import React from 'react';
import Plain from 'slate-plain-serializer';
import { Editor } from 'slate-react';

import { BracesPlugin } from './braces';

describe('braces', () => {
  const handler = BracesPlugin().onKeyDown!;
  const nextMock = () => {};

  it('adds closing braces around empty value', () => {
    const value = Plain.deserialize('');
    const editor = shallow<Editor>(<Editor value={value} />);
    const event = new window.KeyboardEvent('keydown', { key: '(' });
    expect(handler(event as any, editor.instance(), nextMock)).toBeTruthy();
    expect(Plain.serialize(editor.instance().value)).toEqual('()');
  });

  it('removes closing brace when opening brace is removed', () => {
    const value = Plain.deserialize('time()');
    const editor = shallow<Editor>(<Editor value={value} />);
    const event = new window.KeyboardEvent('keydown', { key: 'Backspace' });
    editor.instance().moveForward(5);
    handler(event as any, editor.instance(), nextMock);
    expect(Plain.serialize(editor.instance().value)).toEqual('time');
  });

  it('keeps closing brace when opening brace is removed and inner values exist', () => {
    const value = Plain.deserialize('time(value)');
    const editor = shallow<Editor>(<Editor value={value} />);
    const event = new window.KeyboardEvent('keydown', { key: 'Backspace' });
    editor.instance().moveForward(5);
    const handled = handler(event as any, editor.instance(), nextMock);
    expect(handled).toBeFalsy();
  });

  it('overrides an automatically inserted brace', () => {
    const value = Plain.deserialize('');
    const editor = shallow<Editor>(<Editor value={value} />);
    const opening = new window.KeyboardEvent('keydown', { key: '(' });
    expect(handler(opening as any, editor.instance(), nextMock)).toBeTruthy();
    const closing = new window.KeyboardEvent('keydown', { key: ')' });
    expect(handler(closing as any, editor.instance(), nextMock)).toBeTruthy();
    expect(Plain.serialize(editor.instance().value)).toEqual('()');
  });

  it.skip('does not override manually inserted braces', () => {
    const value = Plain.deserialize('');
    const editor = shallow<Editor>(<Editor value={value} />);
    const event1 = new window.KeyboardEvent('keydown', { key: ')' });
    expect(handler(event1 as any, editor.instance(), nextMock)).toBeFalsy();
    const event2 = new window.KeyboardEvent('keydown', { key: ')' });
    editor.instance().moveBackward(1);
    expect(handler(event2 as any, editor.instance(), nextMock)).toBeFalsy();
    expect(Plain.serialize(editor.instance().value)).toEqual('))');
  });
});
