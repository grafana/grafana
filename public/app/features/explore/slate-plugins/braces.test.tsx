import React from 'react';
import Plain from 'slate-plain-serializer';
import { Editor } from '@grafana/slate-react';
import { shallow } from 'enzyme';
import BracesPlugin from './braces';

declare global {
  interface Window {
    KeyboardEvent: any;
  }
}

describe('braces', () => {
  const handler = BracesPlugin().onKeyDown;
  const nextMock = () => {};

  it('adds closing braces around empty value', () => {
    const value = Plain.deserialize('');
    const editor = shallow<Editor>(<Editor value={value} />);
    const event = new window.KeyboardEvent('keydown', { key: '(' });
    handler(event as Event, editor.instance() as any, nextMock);
    expect(Plain.serialize(editor.instance().value)).toEqual('()');
  });

  it('removes closing brace when opening brace is removed', () => {
    const value = Plain.deserialize('time()');
    const editor = shallow<Editor>(<Editor value={value} />);
    const event = new window.KeyboardEvent('keydown', { key: 'Backspace' });
    handler(event as Event, editor.instance().moveForward(5) as any, nextMock);
    expect(Plain.serialize(editor.instance().value)).toEqual('time');
  });

  it('keeps closing brace when opening brace is removed and inner values exist', () => {
    const value = Plain.deserialize('time(value)');
    const editor = shallow<Editor>(<Editor value={value} />);
    const event = new window.KeyboardEvent('keydown', { key: 'Backspace' });
    const handled = handler(event as Event, editor.instance().moveForward(5) as any, nextMock);
    expect(handled).toBeFalsy();
  });
});
