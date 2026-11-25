import { loadYaml } from './yaml';

describe('loadYaml', () => {
  it.each(['', '   \n', '# just a comment\n'])('returns undefined for a stream with no documents (%j)', (text) => {
    expect(loadYaml(text)).toBeUndefined();
  });

  it('throws on more than one document', () => {
    expect(() => loadYaml('a: 1\n---\nb: 2\n')).toThrow('expected a single document');
  });

  it('resolves merge keys', () => {
    expect(loadYaml('base: &b\n  x: 1\nchild:\n  <<: *b\n  y: 2\n')).toEqual({ base: { x: 1 }, child: { x: 1, y: 2 } });
  });
});
