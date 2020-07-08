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
});
