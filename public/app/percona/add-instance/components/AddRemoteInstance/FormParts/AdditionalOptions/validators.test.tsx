import { noSymbolsValidator } from './validators';

describe('Validate noSymbol string', () => {
  it('Validator should return undefined if the passed value is valid', () => {
    expect(noSymbolsValidator(' name1,name2, name3, name 4')).toBeUndefined();
  });

  it('Validator should return error message if the passed value is invalid', () => {
    expect(noSymbolsValidator(' name1#,name2, name3, name 4')).toEqual('The name of collector cannot contain symbols');
    expect(noSymbolsValidator('name@')).toEqual('The name of collector cannot contain symbols');
    expect(noSymbolsValidator('name$')).toEqual('The name of collector cannot contain symbols');
    expect(noSymbolsValidator('name%')).toEqual('The name of collector cannot contain symbols');
    expect(noSymbolsValidator('name^')).toEqual('The name of collector cannot contain symbols');
    expect(noSymbolsValidator('name&')).toEqual('The name of collector cannot contain symbols');
    expect(noSymbolsValidator('name*')).toEqual('The name of collector cannot contain symbols');
  });
});
