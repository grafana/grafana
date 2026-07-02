// Smoke tests for the isolated Intl-based timezone helpers.
//
// These use the native Node test runner (no jest), so they can run without
// installing the monorepo's node_modules:
//
//   node --test packages/grafana-data/src/datetime/timezoneutil.test.mjs
//
// The imported module is TypeScript; Node strips the types automatically
// (type stripping is on by default in Node >= 23.6).

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ZONE_ABBREVIATIONS,
  getTimeZoneAbbreviation,
  getTimeZoneOffsetMinutes,
  guessBrowserTimeZone,
  isValidTimeZone,
  listTimeZones,
} from './timezoneutil.ts';

// Fixed timestamps so DST-dependent results are deterministic.
const JAN = Date.UTC(2026, 0, 15); // northern winter / southern summer
const JUL = Date.UTC(2026, 6, 15); // northern summer / southern winter

test('getTimeZoneAbbreviation - common named zones with DST', () => {
  // Northern hemisphere: standard in Jan, daylight in Jul.
  assert.equal(getTimeZoneAbbreviation('Europe/Paris', JAN), 'CET');
  assert.equal(getTimeZoneAbbreviation('Europe/Paris', JUL), 'CEST');
  assert.equal(getTimeZoneAbbreviation('America/New_York', JAN), 'EST');
  assert.equal(getTimeZoneAbbreviation('America/New_York', JUL), 'EDT');
});

test('getTimeZoneAbbreviation - southern hemisphere DST is inverted', () => {
  assert.equal(getTimeZoneAbbreviation('Australia/Sydney', JAN), 'AEDT');
  assert.equal(getTimeZoneAbbreviation('Australia/Sydney', JUL), 'AEST');
});

test('getTimeZoneAbbreviation - Ireland negative-DST quirk', () => {
  // Ireland reports GMT in winter and IST in summer.
  assert.equal(getTimeZoneAbbreviation('Europe/Dublin', JAN), 'GMT');
  assert.equal(getTimeZoneAbbreviation('Europe/Dublin', JUL), 'IST');
});

test('getTimeZoneAbbreviation - zones without DST', () => {
  assert.equal(getTimeZoneAbbreviation('Asia/Kolkata', JAN), 'IST');
  assert.equal(getTimeZoneAbbreviation('Asia/Kolkata', JUL), 'IST');
  assert.equal(getTimeZoneAbbreviation('UTC', JUL), 'UTC');
});

test('getTimeZoneAbbreviation - numeric zones are stripped to empty', () => {
  // Modern tzdb uses numeric abbreviations here; we keep the prior behavior
  // of rendering nothing rather than an offset string.
  assert.equal(getTimeZoneAbbreviation('Asia/Dubai', JUL), '');
  assert.equal(getTimeZoneAbbreviation('America/Sao_Paulo', JUL), '');
  assert.equal(getTimeZoneAbbreviation('Asia/Kathmandu', JUL), '');
});

test('getTimeZoneAbbreviation - unknown zone returns empty', () => {
  assert.equal(getTimeZoneAbbreviation('Foo/Bar', JUL), '');
});

test('getTimeZoneOffsetMinutes - minutes east of UTC', () => {
  assert.equal(getTimeZoneOffsetMinutes('UTC', JUL), 0);
  assert.equal(getTimeZoneOffsetMinutes('America/New_York', JAN), -300); // EST
  assert.equal(getTimeZoneOffsetMinutes('America/New_York', JUL), -240); // EDT
  assert.equal(getTimeZoneOffsetMinutes('Europe/Paris', JUL), 120); // CEST
  assert.equal(getTimeZoneOffsetMinutes('Asia/Kolkata', JUL), 330); // +05:30
  assert.equal(getTimeZoneOffsetMinutes('America/St_Johns', JAN), -210); // -03:30
  assert.equal(getTimeZoneOffsetMinutes('Asia/Dubai', JUL), 240); // +04
});

test('listTimeZones - returns canonical IANA zones', () => {
  const zones = listTimeZones();
  assert.ok(Array.isArray(zones));
  assert.ok(zones.length > 100);
  assert.ok(zones.includes('Europe/Paris'));
  // Every entry the engine reports should be a zone it also accepts. The exact
  // catalog varies by ICU version (e.g. older builds list Europe/Kiev rather
  // than Europe/Kyiv, and may omit UTC), so we don't assert specific members.
  for (const zone of zones) {
    assert.ok(isValidTimeZone(zone), `listed zone should be valid: ${zone}`);
  }
});

test('guessBrowserTimeZone - returns a valid zone', () => {
  const zone = guessBrowserTimeZone();
  assert.equal(typeof zone, 'string');
  assert.ok(zone.length > 0);
  assert.ok(isValidTimeZone(zone));
});

test('isValidTimeZone - accepts known zones, rejects junk', () => {
  assert.equal(isValidTimeZone('Europe/Paris'), true);
  assert.equal(isValidTimeZone('UTC'), true);
  assert.equal(isValidTimeZone('Foo/Bar'), false);
  assert.equal(isValidTimeZone(''), false);
});

test('ZONE_ABBREVIATIONS - entries are well-formed', () => {
  for (const [zone, entry] of Object.entries(ZONE_ABBREVIATIONS)) {
    assert.ok(entry.length === 1 || entry.length === 2, `bad entry for ${zone}`);
    for (const abbr of entry) {
      assert.equal(typeof abbr, 'string');
      assert.ok(abbr.length > 0, `empty abbreviation for ${zone}`);
    }
  }
});

test('getTimeZoneAbbreviation - resolves non-empty for every mapped zone the runtime supports', () => {
  // The set of zones a given ICU build recognizes varies, so we only exercise
  // zones valid in the current runtime; for those the resolver must not throw
  // and must return a non-empty abbreviation at both Jan and Jul.
  for (const zone of Object.keys(ZONE_ABBREVIATIONS)) {
    if (!isValidTimeZone(zone)) {
      continue;
    }
    assert.ok(getTimeZoneAbbreviation(zone, JAN).length > 0, `empty winter abbr for ${zone}`);
    assert.ok(getTimeZoneAbbreviation(zone, JUL).length > 0, `empty summer abbr for ${zone}`);
  }
});
