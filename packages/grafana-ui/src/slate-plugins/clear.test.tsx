import { shallow } from 'enzyme';
import React from 'react';
import Plain from 'slate-plain-serializer';
import { Editor } from 'slate-react';

import { ClearPlugin } from './clear';

describe('clear', () => {
  const handler = ClearPlugin().onKeyDown!;

  it('does not change the empty value', () => {
    const value = Plain.deserialize('');
    const editor = shallow<Editor>(<Editor value={value} />);
    const event = new window.KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
    });
    handler(event as any, editor.instance(), () => {});
    expect(Plain.serialize(editor.instance().value)).toEqual('');
  });

  it('clears to the end of the line', () => {
    const value = Plain.deserialize('foo');
    const editor = shallow<Editor>(<Editor value={value} />);
    const event = new window.KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
    });
    handler(event as any, editor.instance(), () => {});
    expect(Plain.serialize(editor.instance().value)).toEqual('');
  });

  it('clears from the middle to the end of the line', () => {
    const value = Plain.deserialize('foo bar');
    const editor = shallow<Editor>(<Editor value={value} />);
    const event = new window.KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
    });
    editor.instance().moveForward(4);
    handler(event as any, editor.instance(), () => {});
    expect(Plain.serialize(editor.instance().value)).toEqual('foo ');
  });
});
