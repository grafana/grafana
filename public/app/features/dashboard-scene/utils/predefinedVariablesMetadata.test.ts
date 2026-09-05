import { formatPredefinedVariablesAnnotationLabel } from './predefinedVariablesMetadata';

describe('formatPredefinedVariablesAnnotationLabel', () => {
  it('labels absent annotation as None', () => {
    expect(formatPredefinedVariablesAnnotationLabel(undefined)).toBe('None');
  });

  it('labels both-all as All', () => {
    expect(formatPredefinedVariablesAnnotationLabel('{"global":"all","folder":"all"}')).toBe('All');
  });

  it('labels both-none as None', () => {
    expect(formatPredefinedVariablesAnnotationLabel('{"global":"none","folder":"none"}')).toBe('None');
  });

  it('labels global-only as Global', () => {
    expect(formatPredefinedVariablesAnnotationLabel('{"global":"all","folder":"none"}')).toBe('Global');
  });

  it('labels folder-only as Folder', () => {
    expect(formatPredefinedVariablesAnnotationLabel('{"global":"none","folder":"all"}')).toBe('Folder');
  });

  it('labels name lists with the picked names', () => {
    expect(formatPredefinedVariablesAnnotationLabel('{"global":["env"],"folder":"none"}')).toBe('env / None');
    expect(formatPredefinedVariablesAnnotationLabel('{"global":["region","env"],"folder":["cluster"]}')).toBe(
      'env, region / cluster'
    );
  });
});
