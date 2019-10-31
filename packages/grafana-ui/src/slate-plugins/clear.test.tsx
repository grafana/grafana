import Plain from 'slate-plain-serializer';
import React from 'react';
import { Editor } from '@grafana/slate-react';
import { shallow } from 'enzyme';
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
    handler(event as Event, editor.instance() as any, () => {});
    expect(Plain.serialize(editor.instance().value)).toEqual('');
  });

  it('clears to the end of the line', () => {
    const value = Plain.deserialize('foo');
    const editor = shallow<Editor>(<Editor value={value} />);
    const event = new window.KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
    });
    handler(event as Event, editor.instance() as any, () => {});
    expect(Plain.serialize(editor.instance().value)).toEqual('');
  });

  it('clears from the middle to the end of the line', () => {
    const value = Plain.deserialize('foo bar');
    const editor = shallow<Editor>(<Editor value={value} />);
    const event = new window.KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
    });
    handler(event as Event, editor.instance().moveForward(4) as any, () => {});
    expect(Plain.serialize(editor.instance().value)).toEqual('foo ');
  });
});
