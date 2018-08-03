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

  it('adds closing braces around a value', () => {
    const change = Plain.deserialize('foo').change();
    const event = new window.KeyboardEvent('keydown', { key: '(' });
    handler(event, change);
    expect(Plain.serialize(change.value)).toEqual('(foo)');
  });

  it('adds closing braces around the following value only', () => {
    const change = Plain.deserialize('foo bar ugh').change();
    let event;
    event = new window.KeyboardEvent('keydown', { key: '(' });
    handler(event, change);
    expect(Plain.serialize(change.value)).toEqual('(foo) bar ugh');

    // Wrap bar
    change.move(5);
    event = new window.KeyboardEvent('keydown', { key: '(' });
    handler(event, change);
    expect(Plain.serialize(change.value)).toEqual('(foo) (bar) ugh');

    // Create empty parens after (bar)
    change.move(4);
    event = new window.KeyboardEvent('keydown', { key: '(' });
    handler(event, change);
    expect(Plain.serialize(change.value)).toEqual('(foo) (bar)() ugh');
  });
});
