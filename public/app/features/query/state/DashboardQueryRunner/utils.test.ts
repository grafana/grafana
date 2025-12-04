import { AnnotationEvent, AnnotationQuery } from '@grafana/data';
import { getTagColorsFromName } from '@grafana/ui';

import { findMatchingTag, translateQueryResult } from './utils';

describe('findMatchingTag', () => {
  it('should find matching tag (case-insensitive)', () => {
    const eventTags = ['env-prod', 'Critical', 'team-backend'];
    expect(findMatchingTag(eventTags, 'critical, warning, info')).toBe('Critical');
  });

  it('should respect priority order from colorByTags (not event tag order)', () => {
    const eventTags = ['warning', 'critical'];
    expect(findMatchingTag(eventTags, 'critical, warning')).toBe('critical');
  });

  it('should return highest priority tag when event has multiple matches', () => {
    const eventTags = ['info', 'warning', 'critical'];
    expect(findMatchingTag(eventTags, 'critical, warning, info')).toBe('critical');
  });

  it('should return lower priority tag when higher priority not present', () => {
    const eventTags = ['info', 'warning'];
    expect(findMatchingTag(eventTags, 'critical, warning, info')).toBe('warning');
  });

  it('should return undefined when no match', () => {
    const eventTags = ['env-prod', 'team-backend'];
    expect(findMatchingTag(eventTags, 'critical, warning, info')).toBeUndefined();
  });

  it('should handle whitespace in colorByTags', () => {
    const eventTags = ['critical'];
    expect(findMatchingTag(eventTags, '  critical ,  warning  ,  info  ')).toBe('critical');
  });

  it('should return undefined for empty event tags', () => {
    expect(findMatchingTag([], 'critical, warning')).toBeUndefined();
  });
});

describe('translateQueryResult', () => {
  describe('colorByTags', () => {
    it('should use matching tag color when colorByTags matches', () => {
      const annotation = {
        name: 'test',
        iconColor: 'blue',
        colorByTags: 'critical, warning, info',
        enable: true,
      } as AnnotationQuery;
      const results: AnnotationEvent[] = [{ tags: ['env-prod', 'critical'], time: 1 }];

      const translated = translateQueryResult(annotation, results);

      const expectedColor = getTagColorsFromName('critical').color;
      expect(translated[0].color).toBe(expectedColor);
    });

    it('should use different colors for different matching tags', () => {
      const annotation = {
        name: 'test',
        iconColor: 'blue',
        colorByTags: 'critical, warning, info',
        enable: true,
      } as AnnotationQuery;

      const results1 = translateQueryResult(annotation, [{ tags: ['critical'], time: 1 }]);
      const results2 = translateQueryResult(annotation, [{ tags: ['warning'], time: 2 }]);

      expect(results1[0].color).not.toBe(results2[0].color);
    });

    it('should give same color for same matching tags', () => {
      const annotation = {
        name: 'test',
        iconColor: 'blue',
        colorByTags: 'critical, warning, info',
        enable: true,
      } as AnnotationQuery;

      const results1 = translateQueryResult(annotation, [{ tags: ['critical', 'env-prod'], time: 1 }]);
      const results2 = translateQueryResult(annotation, [{ tags: ['team-backend', 'critical'], time: 2 }]);

      expect(results1[0].color).toBe(results2[0].color);
    });

    it('should fallback to iconColor when no matching tag', () => {
      const annotation = {
        name: 'test',
        iconColor: 'blue',
        colorByTags: 'critical, warning, info',
        enable: true,
      } as AnnotationQuery;
      const results: AnnotationEvent[] = [{ tags: ['env-prod', 'team-backend'], time: 1 }];

      const translated = translateQueryResult(annotation, results);

      expect(translated[0].color).toBeDefined();
      expect(translated[0].color).not.toBe(getTagColorsFromName('critical').color);
    });

    it('should fallback to iconColor when no tags', () => {
      const annotation = {
        name: 'test',
        iconColor: 'blue',
        colorByTags: 'critical, warning, info',
        enable: true,
      } as AnnotationQuery;
      const results: AnnotationEvent[] = [{ time: 1 }];

      const translated = translateQueryResult(annotation, results);

      expect(translated[0].color).toBeDefined();
    });

    it('should use iconColor when colorByTags is not set', () => {
      const annotation = {
        name: 'test',
        iconColor: 'red',
        enable: true,
      } as AnnotationQuery;
      const results: AnnotationEvent[] = [{ tags: ['critical'], time: 1 }];

      const translated = translateQueryResult(annotation, results);

      expect(translated[0].color).not.toBe(getTagColorsFromName('critical').color);
    });

    it('should use iconColor when colorByTags is empty string', () => {
      const annotation = {
        name: 'test',
        iconColor: 'red',
        colorByTags: '',
        enable: true,
      } as AnnotationQuery;
      const results: AnnotationEvent[] = [{ tags: ['critical'], time: 1 }];

      const translated = translateQueryResult(annotation, results);

      expect(translated[0].color).not.toBe(getTagColorsFromName('critical').color);
    });

    it('should still override with alert state colors', () => {
      const annotation = {
        name: 'test',
        iconColor: 'blue',
        colorByTags: 'critical, warning, info',
        enable: true,
      } as AnnotationQuery;
      const results: AnnotationEvent[] = [{ tags: ['critical'], time: 1, newState: 'alerting' }];

      const translated = translateQueryResult(annotation, results);

      expect(translated[0].color).toBe('red');
    });
  });

  describe('basic functionality', () => {
    it('should set source, type, and isRegion', () => {
      const annotation = {
        name: 'test-annotation',
        iconColor: 'blue',
        enable: true,
      } as AnnotationQuery;
      const results: AnnotationEvent[] = [{ time: 1, timeEnd: 2 }];

      const translated = translateQueryResult(annotation, results);

      expect(translated[0].source).toBe(annotation);
      expect(translated[0].type).toBe('test-annotation');
      expect(translated[0].isRegion).toBe(true);
    });

    it('should set isRegion to false when no timeEnd', () => {
      const annotation = {
        name: 'test-annotation',
        iconColor: 'blue',
        enable: true,
      } as AnnotationQuery;
      const results: AnnotationEvent[] = [{ time: 1 }];

      const translated = translateQueryResult(annotation, results);

      expect(translated[0].isRegion).toBe(false);
    });
  });
});
