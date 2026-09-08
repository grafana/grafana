import { formatPredefinedVariablesAnnotationLabel } from './predefinedVariablesMetadata';

describe('formatPredefinedVariablesAnnotationLabel', () => {
  it('labels absent annotation as None', () => {
    expect(formatPredefinedVariablesAnnotationLabel(undefined)).toBe('None');
  });

  it('labels both-all as All / All', () => {
    expect(formatPredefinedVariablesAnnotationLabel('{"global":"all","folder":"all"}')).toBe('All / All');
  });

  it('labels both-none as None / None', () => {
    expect(formatPredefinedVariablesAnnotationLabel('{"global":"none","folder":"none"}')).toBe('None / None');
  });

  it('labels global-all as All / None', () => {
    expect(formatPredefinedVariablesAnnotationLabel('{"global":"all","folder":"none"}')).toBe('All / None');
  });

  it('labels folder-all as None / All', () => {
    expect(formatPredefinedVariablesAnnotationLabel('{"global":"none","folder":"all"}')).toBe('None / All');
  });

  it('labels name lists with the picked names', () => {
    expect(formatPredefinedVariablesAnnotationLabel('{"global":["env"],"folder":"none"}')).toBe('env / None');
    expect(formatPredefinedVariablesAnnotationLabel('{"global":["region","env"],"folder":["cluster"]}')).toBe(
      'env, region / cluster'
    );
  });

  it('labels unparsable annotation as None', () => {
    expect(formatPredefinedVariablesAnnotationLabel('{not-json')).toBe('None');
  });
});
