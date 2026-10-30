import { getTextDataUsage } from './dataUsage';
import { RenderMode, TextMode } from './panelcfg.gen';

it.each([
  '${__data.fields.cpu}',
  '${__data.fields.cpu:reduce:mean}',
  '${__value.text}',
  '${__field.name}',
  '${__series.name}',
  '$__data',
  '[[__value]]',
])('recognizes data macro %s', (content) => {
  expect(getTextDataUsage({ content }).dataMacros).toBe(true);
});

it.each([
  '{{data.0.cpu}}',
  '{{#each frames}}{{refId}}{{/each}}',
  '{{json data}}',
  '{{#if (gt data.length 0)}}yes{{/if}}',
  '{{lookup this "data"}}',
  '{{#each (variable "hosts")}}{{@root.data.0.cpu}}{{/each}}',
  '{{#with (variableValue "host")}}{{../data.0.cpu}}{{/with}}',
  '{{variableValue "__data.fields.cpu"}}',
  '{{> dynamicPartial}}',
])('protects data-bound Handlebars %s', (content) => {
  expect(getTextDataUsage({ content }).dataBoundHandlebars).toBe(true);
});

it.each([
  'Static content',
  '${host}',
  '{{date}}',
  '{{#if (eq "a" "a")}}yes{{/if}}',
  '{{variableValue "host"}}',
  '{{join (variable "hosts") ", "}}',
  '{{#each (variable "hosts")}}{{this}} {{@index}}{{/each}}',
  '{{#each (variable "hosts") as |host|}}{{host}}{{/each}}',
  '{{#with (variableValue "host")}}{{this}}{{/with}}',
  '{{! data.0.cpu }}',
  '\\{{data.0.cpu}}',
])('does not infer data use from static Handlebars %s', (content) => {
  expect(getTextDataUsage({ content }).dataBoundHandlebars).toBe(false);
});

it('protects malformed templates without reporting confirmed data-bound Handlebars', () => {
  expect(getTextDataUsage({ content: '{{#each data}}' }).dataBoundHandlebars).toBeUndefined();
});

it('does not interpret Handlebars in Code mode, but still recognizes macros and per-row rendering', () => {
  expect(
    getTextDataUsage({ mode: TextMode.Code, content: '{{data}} ${__value.text}', renderMode: RenderMode.PerRow })
  ).toEqual({ dataMacros: true, perRow: true, dataBoundHandlebars: false });
});
