import { UrlQueryMap } from '@grafana/data';
import { findTemplateVarChanges } from './bridge_srv';

describe('when checking template variables', () => {
  it('detect adding/removing a variable', () => {
    const a: UrlQueryMap = {};
    const b: UrlQueryMap = {
      'var-xyz': 'hello',
      aaa: 'ignore me',
    };

    expect(findTemplateVarChanges(b, a)).toEqual({ 'var-xyz': 'hello' });
    expect(findTemplateVarChanges(a, b)).toEqual({ 'var-xyz': '' });
  });

  it('then should ignore equal values', () => {
    const a: UrlQueryMap = {
      'var-xyz': 'hello',
      bbb: 'ignore me',
    };
    const b: UrlQueryMap = {
      'var-xyz': 'hello',
      aaa: 'ignore me',
    };

    expect(findTemplateVarChanges(b, a)).toBeUndefined();
    expect(findTemplateVarChanges(a, b)).toBeUndefined();
  });

  it('then should ignore equal values with empty values', () => {
    const a: UrlQueryMap = {
      'var-xyz': '',
      bbb: 'ignore me',
    };
    const b: UrlQueryMap = {
      'var-xyz': '',
      aaa: 'ignore me',
    };

    expect(findTemplateVarChanges(b, a)).toBeUndefined();
    expect(findTemplateVarChanges(a, b)).toBeUndefined();
  });

  it('then should ignore empty array values', () => {
    const a: UrlQueryMap = {
      'var-adhoc': [],
    };
    const b: UrlQueryMap = {};

    expect(findTemplateVarChanges(b, a)).toBeUndefined();
    expect(findTemplateVarChanges(a, b)).toBeUndefined();
  });

  it('Should handle array values with one value same as just value', () => {
    const a: UrlQueryMap = {
      'var-test': ['test'],
    };
    const b: UrlQueryMap = {
      'var-test': 'test',
    };

    expect(findTemplateVarChanges(b, a)).toBeUndefined();
    expect(findTemplateVarChanges(a, b)).toBeUndefined();
  });

  it('Should detect change in array value and return array with single value', () => {
    const a: UrlQueryMap = {
      'var-test': ['test'],
    };
    const b: UrlQueryMap = {
      'var-test': 'asd',
    };

    expect(findTemplateVarChanges(a, b)['var-test']).toEqual(['test']);
  });
});
