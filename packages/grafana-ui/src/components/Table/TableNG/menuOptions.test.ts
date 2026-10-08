import { getCellMenuOptions, getColumnMenuOptions } from './menuOptions';

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

describe('getCellMenuOptions', () => {
  it.each([
    [false, false, false, []],
    [true, false, false, [['inspect']]],
    [false, true, false, [['filterFor', 'filterOut']]],
    [false, false, true, [['assistant']]],
    [true, true, true, [['inspect'], ['filterFor', 'filterOut'], ['assistant']]],
  ])(
    'groups cell options (inspect=%s, filters=%s, assistant=%s)',
    (cellInspect, showFilters, hasAssistantAction, expected) => {
      expect(getCellMenuOptions({ cellInspect, showFilters, hasAssistantAction })).toEqual(expected);
    }
  );
});
