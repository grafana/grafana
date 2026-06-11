/**
 * Unit tests for annotation payload schemas.
 *
 * Focus: lock down the partial-update contract for `UPDATE_ANNOTATION`. An
 * empty `spec: {}` must mean "no change", not "reset to defaults". The schema
 * achieves this by composing `stripDefaults(...).partial()` over each entity
 * spec; these tests pin that behavior so a future Zod upgrade or CUE schema
 * change can't silently regress it.
 *
 * Companion to the integration tests in `annotationCommands.test.ts`, which
 * cover the full command-handler flow. Tests here parse payloads directly so
 * they fail fast and isolate Zod-level regressions from handler-level ones.
 */

import { updateAnnotationPayloadSchema } from './schemas';

describe('updateAnnotationPayloadSchema', () => {
  describe('envelope', () => {
    it('accepts the minimal valid payload', () => {
      const result = updateAnnotationPayloadSchema.safeParse({
        name: 'deploys',
        annotation: { spec: {} },
      });
      expect(result.success).toBe(true);
    });

    it.each([
      ['name', { annotation: { spec: {} } }],
      ['annotation', { name: 'deploys' }],
    ])('rejects payload missing `%s`', (_field, payload) => {
      expect(updateAnnotationPayloadSchema.safeParse(payload).success).toBe(false);
    });
  });

  describe('annotation.kind', () => {
    it('defaults to "AnnotationQuery" when omitted (kind is sourced from the generated schema)', () => {
      const result = updateAnnotationPayloadSchema.parse({
        name: 'deploys',
        annotation: { spec: {} },
      });
      expect(result.annotation.kind).toBe('AnnotationQuery');
    });

    it('accepts explicit "AnnotationQuery"', () => {
      const result = updateAnnotationPayloadSchema.parse({
        name: 'deploys',
        annotation: { kind: 'AnnotationQuery', spec: {} },
      });
      expect(result.annotation.kind).toBe('AnnotationQuery');
    });

    it('rejects unknown kind literals', () => {
      const result = updateAnnotationPayloadSchema.safeParse({
        name: 'deploys',
        annotation: { kind: 'SomethingElse', spec: {} },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('annotation.spec partial', () => {
    it('parses an empty spec to an empty object', () => {
      const result = updateAnnotationPayloadSchema.parse({
        name: 'deploys',
        annotation: { spec: {} },
      });
      expect(result.annotation.spec).toEqual({});
    });

    it('keeps only the keys the client actually sent', () => {
      const result = updateAnnotationPayloadSchema.parse({
        name: 'deploys',
        annotation: { spec: { name: 'renamed' } },
      });
      expect(result.annotation.spec).toEqual({ name: 'renamed' });
    });

    it.each(['iconColor', 'enable', 'hide', 'builtIn'])('does not inject the default value for omitted `%s`', (key) => {
      const result = updateAnnotationPayloadSchema.parse({
        name: 'deploys',
        annotation: { spec: { name: 'x' } },
      });
      expect(result.annotation.spec).not.toHaveProperty(key);
    });

    it('preserves caller-supplied values verbatim', () => {
      const result = updateAnnotationPayloadSchema.parse({
        name: 'deploys',
        annotation: { spec: { iconColor: 'orange', enable: false, hide: true } },
      });
      expect(result.annotation.spec).toEqual({ iconColor: 'orange', enable: false, hide: true });
    });

    it.each([
      ['enable', 'yes'],
      ['hide', 1],
      ['iconColor', 7],
      ['builtIn', 'true'],
      ['name', 42],
    ])('rejects `%s` with wrong type (%p)', (key, value) => {
      const result = updateAnnotationPayloadSchema.safeParse({
        name: 'deploys',
        annotation: { spec: { [key]: value } },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('annotation.spec.filter partial', () => {
    it('accepts partial filter without injecting the `exclude` default', () => {
      const result = updateAnnotationPayloadSchema.parse({
        name: 'deploys',
        annotation: { spec: { filter: { ids: [1, 2] } } },
      });
      expect(result.annotation.spec.filter).toEqual({ ids: [1, 2] });
    });

    it('accepts a fully-specified filter verbatim', () => {
      const result = updateAnnotationPayloadSchema.parse({
        name: 'deploys',
        annotation: { spec: { filter: { exclude: true, ids: [9] } } },
      });
      expect(result.annotation.spec.filter).toEqual({ exclude: true, ids: [9] });
    });
  });

  describe('annotation.spec.mappings record', () => {
    it('accepts an empty record', () => {
      const result = updateAnnotationPayloadSchema.parse({
        name: 'deploys',
        annotation: { spec: { mappings: {} } },
      });
      expect(result.annotation.spec.mappings).toEqual({});
    });

    it('keeps each record value partial (no `source` default injected)', () => {
      const result = updateAnnotationPayloadSchema.parse({
        name: 'deploys',
        annotation: { spec: { mappings: { time: { regex: '\\d+' } } } },
      });
      expect(result.annotation.spec.mappings).toEqual({ time: { regex: '\\d+' } });
    });
  });

  describe('annotation.spec.query deep partial', () => {
    it('accepts an empty query (every inner field optional)', () => {
      const result = updateAnnotationPayloadSchema.parse({
        name: 'deploys',
        annotation: { spec: { query: {} } },
      });
      expect(result.annotation.spec.query).toEqual({});
    });

    it('does not inject `kind` or `version` defaults inside query', () => {
      const result = updateAnnotationPayloadSchema.parse({
        name: 'deploys',
        annotation: { spec: { query: { group: 'prometheus' } } },
      });
      expect(result.annotation.spec.query).toEqual({ group: 'prometheus' });
    });

    it('passes through a fully-specified query verbatim', () => {
      const query = {
        kind: 'DataQuery' as const,
        group: 'prometheus',
        version: 'v0',
        spec: { expr: 'up' },
      };
      const result = updateAnnotationPayloadSchema.parse({
        name: 'deploys',
        annotation: { spec: { query } },
      });
      expect(result.annotation.spec.query).toEqual(query);
    });
  });
});
