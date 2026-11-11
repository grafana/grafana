import { getTextDataUsage } from './dataUsage';
import { RenderMode, TextMode } from './panelcfg.gen';

it.each([
  '${__data.fields.cpu}',
  '${__data.fields.cpu:reduce:mean}',
  '${__value.text}',
  '${__field.name}',
  '${__series.name}',
])('recognizes data macro %s', (content) => {
  expect(getTextDataUsage({ content }).dataMacros).toBe(true);
});

it.each([
  '{{data.0.cpu}}',
  '{{date}}',
  '{{variableValue "host"}}',
  '{{> dynamicPartial}}',
  '{{! data.0.cpu }}',
  '\\{{data.0.cpu}}',
  '{{#each data}}',
])('recognizes complete Handlebars expressions: %s', (content) => {
  expect(getTextDataUsage({ content }).handlebars).toBe(true);
});

it('does not report Handlebars for static content', () => {
  expect(getTextDataUsage({ content: 'Static ${host}' }).handlebars).toBe(false);
});

it('does not interpret Handlebars in Code mode, but still recognizes macros and per-row rendering', () => {
  expect(
    getTextDataUsage({ mode: TextMode.Code, content: '{{data}} ${__value.text}', renderMode: RenderMode.PerRow })
  ).toEqual({ dataMacros: true, handlebars: false, perRow: true });
});

it('does not count incomplete templates or legacy bracket macros', () => {
  expect(getTextDataUsage({ content: '{{unfinished [[__value]]' })).toEqual({
    dataMacros: false,
    handlebars: false,
    perRow: false,
  });
});
