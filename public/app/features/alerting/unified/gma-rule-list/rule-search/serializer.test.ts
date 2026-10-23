import { alertFilters } from './alertFilters';
import { type FilterDefinition } from './filterDefinitions';
import { parse } from './parser';
import { recordingFilters } from './recordingFilters';
import { type RuleSearchFilter, createEmptyFilter } from './ruleSearchFilter';
import { serialize } from './serializer';

describe('serialize', () => {
  it.each<{ name: string; filter: Partial<RuleSearchFilter>; expected: string }>([
    { name: 'an empty filter', filter: {}, expected: '' },
    { name: 'free text', filter: { text: ['cpu', 'high'] }, expected: 'cpu high' },
    { name: 'free text with a space', filter: { text: ['high load'] }, expected: '"high load"' },
    { name: 'free text that reads as a filter', filter: { text: ['state:firing'] }, expected: '"state:firing"' },
    { name: 'free text with a key the page has no filter for', filter: { text: ['http:500'] }, expected: 'http:500' },
    { name: 'free text with a colon and no key', filter: { text: ['1:2:3'] }, expected: '1:2:3' },
    { name: 'folders', filter: { folders: ['f1', 'My Folder'] }, expected: 'folder:f1 folder:"My Folder"' },
    { name: 'data sources', filter: { dataSourceUids: ['ds-1'] }, expected: 'datasource:ds-1' },
    {
      name: 'every label operator',
      filter: {
        labels: [
          { key: 'a', operator: 'exists' },
          { key: 'b', operator: 'absent' },
          { key: 'c', operator: 'equal', value: 'x' },
          { key: 'd', operator: 'notEqual', value: 'y' },
          { key: 'e', operator: 'regex', value: 'z.*' },
          { key: 'f', operator: 'notRegex', value: 'w.*' },
        ],
      },
      expected: 'label:a label:!b label:c=x label:d!=y label:e=~z.* label:f!~w.*',
    },
    {
      name: 'a label value with a space',
      filter: { labels: [{ key: 'team', operator: 'equal', value: 'api platform' }] },
      expected: 'label:"team=api platform"',
    },
    { name: 'hidden plugin rules', filter: { hidePluginRules: true }, expected: 'plugins:hide' },
    {
      name: 'the Alert-only filters',
      filter: {
        dashboardUid: 'dash-1',
        panelId: '4',
        contactPoint: 'on call',
        policy: 'escalation',
        paused: 'false',
        state: 'normal',
      },
      expected: 'dashboard:dash-1 panelId:4 contactPoint:"on call" policy:escalation paused:false state:normal',
    },
    {
      name: 'the Recording-only filters',
      filter: { metric: 'cpu_usage', targetDataSourceUid: 'ds-2', health: 'nodata' },
      expected: 'metric:cpu_usage targetDatasource:ds-2 health:nodata',
    },
    {
      name: 'invalid tokens, unchanged and after the free text',
      filter: {
        text: ['cpu'],
        invalid: [
          { key: 'label', raw: 'label:' },
          { key: 'folder', raw: 'folder:"a b' },
        ],
      },
      expected: 'cpu label: folder:"a b',
    },
    {
      name: 'filters in a fixed order, free text last',
      filter: {
        text: ['cpu'],
        health: 'error',
        state: 'firing',
        hidePluginRules: true,
        labels: [{ key: 'team', operator: 'exists' }],
        folders: ['f1'],
      },
      expected: 'folder:f1 label:team plugins:hide state:firing health:error cpu',
    },
  ])('writes $name', ({ filter, expected }) => {
    expect(serialize({ ...createEmptyFilter(), ...filter }, alertFilters)).toBe(expected);
  });
});

describe('parse and serialize round-trips', () => {
  it.each<{ name: string; filters: FilterDefinition[]; filter: Partial<RuleSearchFilter> }>([
    {
      name: 'a fully populated Alert filter',
      filters: alertFilters,
      filter: {
        text: ['cpu', 'high load', 'http:500', 'state:firing'],
        folders: ['folder-1', 'My Folder'],
        dataSourceUids: ['ds-1', 'ds-2'],
        labels: [
          { key: 'team', operator: 'exists' },
          { key: 'env', operator: 'absent' },
          { key: 'app', operator: 'equal', value: 'api platform' },
          { key: 'app', operator: 'notEqual', value: 'web' },
          { key: 'host', operator: 'regex', value: 'api.*' },
          { key: 'host', operator: 'notRegex', value: 'web.*' },
        ],
        hidePluginRules: true,
        dashboardUid: 'dash-1',
        panelId: '4',
        contactPoint: 'on-call',
        policy: 'default',
        paused: 'true',
        state: 'firing',
        health: 'error',
      },
    },
    {
      name: 'a fully populated Recording filter',
      filters: recordingFilters,
      filter: {
        text: ['high load'],
        folders: ['folder-1'],
        dataSourceUids: ['ds-1'],
        labels: [{ key: 'app', operator: 'equal', value: 'api' }],
        hidePluginRules: true,
        metric: 'cpu_usage',
        targetDataSourceUid: 'target-ds-1',
        health: 'ok',
      },
    },
    {
      name: 'invalid tokens',
      filters: alertFilters,
      filter: {
        text: ['cpu'],
        folders: ['folder-1'],
        invalid: [
          { key: 'label', raw: 'label:' },
          { key: 'paused', raw: 'paused:maybe' },
          { key: 'folder', raw: 'folder:"My Fol' },
        ],
      },
    },
  ])('parse(serialize(filter)) gives back $name', ({ filters, filter }) => {
    const complete = { ...createEmptyFilter(), ...filter };
    expect(parse(serialize(complete, filters), filters)).toEqual(complete);
  });

  it.each([
    ['label:team=api cpu  folder:folder-1', 'folder:folder-1 label:team=api cpu'],
    ['rule:"team:api" "high load"', 'team:api "high load"'],
    ['rule:"state:firing"', '"state:firing"'],
    ['state:FIRING health:NoData', 'state:firing health:nodata'],
    ['policy:user-defined', 'policy:default'],
    ['foo:bar cpu label: paused:maybe', 'foo:bar cpu label: paused:maybe'],
    ['metric:cpu foo:"a b"', 'metric:cpu "foo:a b"'],
    ['cpu label:"team', 'cpu label:"team'],
    ['label:"team cpu', 'label:"team cpu'],
  ])('writes %j in its canonical form %j, which reads back unchanged', (input, canonical) => {
    const serialized = serialize(parse(input, alertFilters), alertFilters);

    expect(serialized).toBe(canonical);
    expect(serialize(parse(serialized, alertFilters), alertFilters)).toBe(canonical);
  });
});
