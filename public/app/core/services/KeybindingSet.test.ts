import { KeybindingSet } from './KeybindingSet';
import { mousetrap } from './mousetrap';

jest.mock('./mousetrap');

afterAll(() => {
  jest.unmock('./mousetrap');
});

describe('KeybindingSet', () => {
  let keyBindingSet: KeybindingSet;
  beforeEach(() => {
    keyBindingSet = new KeybindingSet();
  });

  test('Binds and unbinds keys', () => {
    keyBindingSet.addBinding({
      key: 'a b',
      onTrigger: () => {},
    });

    expect(mousetrap.bind).toHaveBeenCalledTimes(1);
    expect(mousetrap.bind).toHaveBeenCalledWith('a b', expect.any(Function), 'keydown');

    keyBindingSet.removeAll();

    expect(mousetrap.unbind).toHaveBeenCalledTimes(1);
    expect(mousetrap.unbind).toHaveBeenCalledWith('a b', 'keydown');
  });

  test('Binds and unbinds keys of a certain type', () => {
    keyBindingSet.addBinding({
      key: 'a b',
      onTrigger: () => {},
      type: 'keypress',
    });

    expect(mousetrap.bind).toHaveBeenCalledWith('a b', expect.any(Function), 'keypress');

    keyBindingSet.removeAll();

    expect(mousetrap.unbind).toHaveBeenCalledWith('a b', 'keypress');
  });
});
