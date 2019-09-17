// @ts-ignore
import Plain from 'slate-plain-serializer';

import BracesPlugin from './braces';

declare global {
  interface Window {
    KeyboardEvent: any;
  }
}

describe('braces', () => {
  const handler = BracesPlugin().onKeyDown;

  it('adds closing braces around empty value', () => {
    const change = Plain.deserialize('').change();
    const event = new window.KeyboardEvent('keydown', { key: '(' });
    handler(event, change);
    expect(Plain.serialize(change.value)).toEqual('()');
  });

  it('removes closing brace when opening brace is removed', () => {
    const change = Plain.deserialize('time()').change();
    let event;
    change.move(5);
    event = new window.KeyboardEvent('keydown', { key: 'Backspace' });
    handler(event, change);
    expect(Plain.serialize(change.value)).toEqual('time');
  });

  it('keeps closing brace when opening brace is removed and inner values exist', () => {
    const change = Plain.deserialize('time(value)').change();
    let event;
    change.move(5);
    event = new window.KeyboardEvent('keydown', { key: 'Backspace' });
    const handled = handler(event, change);
    expect(handled).toBeFalsy();
  });
});
