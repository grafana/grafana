import { Matcher } from 'app/plugins/datasource/alertmanager/types';

import { matchesSilenceMatcher } from './matchesSilenceMatcher';

describe('matchesSilenceMatcher', () => {
  const silenceMatcher: Matcher = { name: 'foo', value: 'bar', isRegex: false, isEqual: true };

  describe('equals filter (=)', () => {
    it('matches when name and value are equal', () => {
      const filter: Matcher = { name: 'foo', value: 'bar', isRegex: false, isEqual: true };
      expect(matchesSilenceMatcher(filter, silenceMatcher)).toBe(true);
    });

    it('does not match when value differs', () => {
      const filter: Matcher = { name: 'foo', value: 'baz', isRegex: false, isEqual: true };
      expect(matchesSilenceMatcher(filter, silenceMatcher)).toBe(false);
    });

    it('does not match when name differs', () => {
      const filter: Matcher = { name: 'other', value: 'bar', isRegex: false, isEqual: true };
      expect(matchesSilenceMatcher(filter, silenceMatcher)).toBe(false);
    });

    it('matches regardless of silence matcher operator type', () => {
      const notEqualSilenceMatcher: Matcher = { name: 'foo', value: 'bar', isRegex: false, isEqual: false };
      const filter: Matcher = { name: 'foo', value: 'bar', isRegex: false, isEqual: true };
      expect(matchesSilenceMatcher(filter, notEqualSilenceMatcher)).toBe(true);
    });
  });

  describe('not-equal filter (!=)', () => {
    it('matches when value does not equal filter value', () => {
      const filter: Matcher = { name: 'foo', value: 'baz', isRegex: false, isEqual: false };
      expect(matchesSilenceMatcher(filter, silenceMatcher)).toBe(true);
    });

    it('does not match when value equals filter value', () => {
      const filter: Matcher = { name: 'foo', value: 'bar', isRegex: false, isEqual: false };
      expect(matchesSilenceMatcher(filter, silenceMatcher)).toBe(false);
    });

    it('matches regardless of silence matcher operator type', () => {
      const regexSilenceMatcher: Matcher = { name: 'foo', value: 'bar', isRegex: true, isEqual: true };
      const filter: Matcher = { name: 'foo', value: 'baz', isRegex: false, isEqual: false };
      expect(matchesSilenceMatcher(filter, regexSilenceMatcher)).toBe(true);
    });
  });

  describe('regex filter (=~)', () => {
    it('matches when regex matches the value', () => {
      const filter: Matcher = { name: 'foo', value: 'b.*', isRegex: true, isEqual: true };
      expect(matchesSilenceMatcher(filter, silenceMatcher)).toBe(true);
    });

    it('does not match when regex does not match the value', () => {
      const filter: Matcher = { name: 'foo', value: '^z', isRegex: true, isEqual: true };
      expect(matchesSilenceMatcher(filter, silenceMatcher)).toBe(false);
    });

    it('matches regardless of silence matcher operator type', () => {
      const regexSilenceMatcher: Matcher = { name: 'foo', value: 'bar', isRegex: true, isEqual: true };
      const filter: Matcher = { name: 'foo', value: 'b.*', isRegex: true, isEqual: true };
      expect(matchesSilenceMatcher(filter, regexSilenceMatcher)).toBe(true);
    });

    it('matches against not-equal silence matcher', () => {
      const notEqualSilenceMatcher: Matcher = { name: 'foo', value: 'bar', isRegex: false, isEqual: false };
      const filter: Matcher = { name: 'foo', value: 'b.*', isRegex: true, isEqual: true };
      expect(matchesSilenceMatcher(filter, notEqualSilenceMatcher)).toBe(true);
    });

    it('does not partial-match (regex is anchored like Prometheus)', () => {
      const filter: Matcher = { name: 'foo', value: 'ba', isRegex: true, isEqual: true };
      const matcher: Matcher = { name: 'foo', value: 'bar', isRegex: false, isEqual: true };
      expect(matchesSilenceMatcher(filter, matcher)).toBe(false);
    });
  });

  describe('negative regex filter (!~)', () => {
    it('does not match when regex matches the value', () => {
      const filter: Matcher = { name: 'foo', value: 'b.*', isRegex: true, isEqual: false };
      expect(matchesSilenceMatcher(filter, silenceMatcher)).toBe(false);
    });

    it('matches when regex does not match the value', () => {
      const filter: Matcher = { name: 'foo', value: '^z', isRegex: true, isEqual: false };
      expect(matchesSilenceMatcher(filter, silenceMatcher)).toBe(true);
    });
  });

  describe('invalid regex', () => {
    it('returns false for invalid regex pattern', () => {
      const filter: Matcher = { name: 'foo', value: '[invalid', isRegex: true, isEqual: true };
      expect(matchesSilenceMatcher(filter, silenceMatcher)).toBe(false);
    });
  });
});
