import Plain from 'slate-plain-serializer';

import ClearPlugin from './clear';

describe('clear', () => {
  const handler = ClearPlugin().onKeyDown;

  it('does not change the empty value', () => {
    const change = Plain.deserialize('').change();
    const event = new window.KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
    });
    handler(event, change);
    expect(Plain.serialize(change.value)).toEqual('');
  });

  it('clears to the end of the line', () => {
    const change = Plain.deserialize('foo').change();
    const event = new window.KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
    });
    handler(event, change);
    expect(Plain.serialize(change.value)).toEqual('');
  });

  it('clears from the middle to the end of the line', () => {
    const change = Plain.deserialize('foo bar').change();
    change.move(4);
    const event = new window.KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
    });
    handler(event, change);
    expect(Plain.serialize(change.value)).toEqual('foo ');
  });
});
