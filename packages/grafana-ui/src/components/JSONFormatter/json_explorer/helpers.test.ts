import { getValuePreview } from './helpers';

describe('getValuePreview', () => {
  it('should put double quotes around a string value', () => {
    const jsonObject: any = 'a string';
    const output = getValuePreview(jsonObject, jsonObject.toString());

    expect(output).toBe(`"a string"`);
  });

  it('should escape multiple double quotes in a string value', () => {
    const jsonObject: any = '"a quoted string"';
    const output = getValuePreview(jsonObject, jsonObject.toString());

    expect(output).toBe(`"\\"a quoted string\\""`);
  });

  it('should escape backslashes in a string value', () => {
    const jsonObject: any = 'a string with backslash \\ and quote"';
    const output = getValuePreview(jsonObject, jsonObject.toString());

    expect(output).toBe(`"a string with backslash \\\\ and quote\\\""`);
  });
});
