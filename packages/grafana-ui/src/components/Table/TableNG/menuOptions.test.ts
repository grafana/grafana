import { getColumnMenuOptions } from './menuOptions';

describe('getColumnMenuOptions', () => {
  it.each([
    [{}, []],
    [{ filterable: true }, [['filter']]],
    [{ hideable: true }, [['hide']]],
    [{ hasColumnSidebar: true }, [['manage']]],
    [{ hasAssistantAction: true }, [['assistant']]],
    [{ hideable: true, hasColumnSidebar: true }, [['hide', 'manage']]],
    [
      { filterable: true, hideable: true, hasColumnSidebar: true, hasAssistantAction: true },
      [['filter'], ['hide', 'manage'], ['assistant']],
    ],
  ])('groups column options for %j', (capabilities, expected) => {
    expect(getColumnMenuOptions(capabilities)).toEqual(expected);
  });
});
