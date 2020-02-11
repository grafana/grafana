import { UrlQueryMap } from '@grafana/runtime';
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
});
