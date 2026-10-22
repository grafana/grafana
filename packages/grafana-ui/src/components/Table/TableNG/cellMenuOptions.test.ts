import { getCellMenuOptions } from './cellMenuOptions';

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
