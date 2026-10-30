import { type Options, RenderMode, TextMode } from './panelcfg.gen';
import { shouldClearTextQueries } from './queryMigration';

it.each(['6.1.0', '12.9.0', '13.0.0', '13.2.9', '13.2.0-pre'])('clears all pre-13.3 queries (%s)', (version) => {
  expect(shouldClearTextQueries(version, { content: '${__data.fields.cpu}', renderMode: RenderMode.PerRow })).toBe(
    true
  );
});

it.each(['13.3.0', '13.3.10', '13.3.0-pre', '13.3.1+security', undefined, '', 'invalid'])(
  'protects possible data use for version %s',
  (version) => {
    expect(shouldClearTextQueries(version, { content: 'Static' })).toBe(true);
    expect(shouldClearTextQueries(version, { content: '{{date}} ${host}' })).toBe(true);
    expect(shouldClearTextQueries(version, { content: '${__data.fields.cpu}' })).toBe(false);
    expect(shouldClearTextQueries(version, { content: '{{#each data}}{{cpu}}{{/each}}' })).toBe(false);
    expect(shouldClearTextQueries(version, { content: 'Static', renderMode: RenderMode.PerRow })).toBe(false);
    expect(shouldClearTextQueries(version, { content: '{{#if' })).toBe(false);
  }
);

it.each(['13.4.0-pre', '13.4.0', '13.10.0', '14.0.0'])('preserves queries from %s', (version) => {
  expect(shouldClearTextQueries(version, { content: 'Static' })).toBe(false);
});

it('clears 13.3 queries when Handlebars is only displayed as code', () => {
  const options: Partial<Options> = { content: '{{data.0.cpu}}', mode: TextMode.Code };
  expect(shouldClearTextQueries('13.3.0', options)).toBe(true);
});
