import { prepareAnnotation } from './migrations';

describe('Graphite annotation migrations', () => {
  describe('legacy target annotations', () => {
    it('migrates a legacy graphite query string into a target', () => {
      expect(prepareAnnotation({ target: 'statsd.application.counters.*.count' }).target).toEqual({
        fromAnnotations: true,
        target: 'statsd.application.counters.*.count',
        textEditor: true,
      });
    });

    it('leaves an already migrated target untouched', () => {
      const target = { queryType: 'tags', tags: ['deploy'], fromAnnotations: true };

      expect(prepareAnnotation({ target }).target).toBe(target);
    });

    it('treats an empty target string as a tags annotation', () => {
      expect(prepareAnnotation({ target: '' }).target).toEqual({
        queryType: 'tags',
        tags: [],
        fromAnnotations: true,
      });
    });
  });

  describe('legacy tags annotations', () => {
    it('splits a space-separated tags string', () => {
      expect(prepareAnnotation({ tags: 'deploy success' }).target).toEqual({
        queryType: 'tags',
        tags: ['deploy', 'success'],
        fromAnnotations: true,
      });
    });

    it('drops empty segments from a padded tags string', () => {
      expect(prepareAnnotation({ tags: '  deploy   success ' }).target).toMatchObject({
        tags: ['deploy', 'success'],
      });
    });

    it('accepts an array of tags without throwing', () => {
      expect(prepareAnnotation({ tags: ['deploy', 'success'] }).target).toEqual({
        queryType: 'tags',
        tags: ['deploy', 'success'],
        fromAnnotations: true,
      });
    });

    it('preserves array tags that contain spaces', () => {
      expect(prepareAnnotation({ tags: ['event=deploy status=success'] }).target).toMatchObject({
        tags: ['event=deploy status=success'],
      });
    });

    it('coerces non-string array entries', () => {
      expect(prepareAnnotation({ tags: [1, 'deploy', null, undefined, ''] }).target).toMatchObject({
        tags: ['1', 'deploy'],
      });
    });

    it('yields no tags for an empty array', () => {
      expect(prepareAnnotation({ tags: [] }).target).toMatchObject({ tags: [] });
    });

    it('yields no tags when tags are missing', () => {
      expect(prepareAnnotation({}).target).toEqual({
        queryType: 'tags',
        tags: [],
        fromAnnotations: true,
      });
    });
  });

  describe('dashboard schema v2 annotations', () => {
    // v2 stores the query under annotation.query.spec, so target is falsy and the legacy
    // migration branch runs on every open of the annotations editor
    it('does not throw when the query lives under query.spec', () => {
      const annotation = {
        name: 'Completed Deployments',
        query: { kind: 'DataQuery', spec: { queryType: 'tags', tags: ['deploy'] } },
      };

      expect(prepareAnnotation(annotation).target).toEqual({
        queryType: 'tags',
        tags: [],
        fromAnnotations: true,
      });
    });
  });

  describe('annotations carried over from the built-in Grafana datasource', () => {
    // the built-in annotation datasource writes root-level tags as string[]; switching such an
    // annotation to Graphite used to throw `json.tags.split is not a function`
    it('does not throw on a built-in annotation shape', () => {
      const annotation = {
        name: 'Failed Deployments',
        type: 'tags',
        limit: 100,
        matchAny: false,
        tags: ['deploy', 'failed'],
      };

      expect(() => prepareAnnotation(annotation)).not.toThrow();
      expect(prepareAnnotation(annotation).target).toMatchObject({ tags: ['deploy', 'failed'] });
    });
  });
});
