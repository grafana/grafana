import { type FieldConfigSource, MappingType, type ValueMapping } from '@grafana/data';
import { appEvents } from 'app/core/app_events';
import { DashboardDiscardedEvent, DashboardSavedEvent } from 'app/types/events';

import { CodeLanguage, RenderMode, type Options, TextMode } from '../panelcfg.gen';

import { TextPanelInteractions } from './main';
import { deriveSavedProperties, TextPanelSaveTracker, type TextPanelSnapshot } from './saveTracker';

jest.mock('./main', () => ({
  TextPanelInteractions: { saved: jest.fn() },
}));

const saved = jest.mocked(TextPanelInteractions.saved);

function snapshot(overrides: Partial<TextPanelSnapshot> = {}): TextPanelSnapshot {
  return {
    options: { mode: TextMode.Markdown, content: '', renderMode: RenderMode.Once },
    fieldConfig: { defaults: {}, overrides: [] },
    newFeaturesEnabled: true,
    hasData: false,
    editorViewAtSave: 'preview',
    editorViewChanged: false,
    contentChanged: false,
    ...overrides,
  };
}

function withContent(content: string, overrides: Partial<TextPanelSnapshot> = {}): TextPanelSnapshot {
  return snapshot({ options: { mode: TextMode.Markdown, content, renderMode: RenderMode.Once }, ...overrides });
}

function forContent(content: string, options: Partial<Options> = {}) {
  return deriveSavedProperties(
    snapshot({ options: { mode: TextMode.Markdown, content, renderMode: RenderMode.Once, ...options } })
  );
}

function forFieldConfig(defaults: FieldConfigSource['defaults'], overrides: FieldConfigSource['overrides'] = []) {
  return deriveSavedProperties(snapshot({ fieldConfig: { defaults, overrides } }));
}

describe('deriveSavedProperties', () => {
  it('never reports the template text itself', () => {
    const reported = JSON.stringify(forContent('Escalate to {{oncallEngineer}} at acme-corp.internal'));

    expect(reported).not.toContain('oncallEngineer');
    expect(reported).not.toContain('acme-corp');
  });

  it('reports the modes the panel was saved in', () => {
    const props = forContent('{{host}}', { mode: TextMode.HTML, renderMode: RenderMode.PerRow });

    expect(props.mode).toBe(TextMode.HTML);
    expect(props.renderMode).toBe(RenderMode.PerRow);
  });

  it('falls back to the default render mode when the panel has none', () => {
    expect(deriveSavedProperties(snapshot({ options: { mode: TextMode.Markdown, content: '' } })).renderMode).toBe(
      RenderMode.Once
    );
  });

  it.each([
    { name: 'a template with Handlebars', content: '{{#each data}}{{host}}{{/each}}', expected: true },
    { name: 'plain markdown', content: '# Title', expected: false },
  ])('reports hasHandlebars=$expected for $name', ({ content, expected }) => {
    expect(forContent(content).hasHandlebars).toBe(expected);
  });

  it('reports no Handlebars in code mode, where the source is shown verbatim', () => {
    const props = forContent('{{#each data}}{{cpu}}{{/each}}', {
      mode: TextMode.Code,
      code: { language: CodeLanguage.Yaml, showLineNumbers: true, showMiniMap: false },
    });

    expect(props.hasHandlebars).toBe(false);
  });

  it.each([
    { name: 'a fenced block', content: '```mermaid\ngraph TD;\n```', expected: true },
    { name: 'a pre element', content: '<pre class="mermaid">graph TD;</pre>', expected: true },
    { name: 'prose mentioning it', content: 'we should try mermaid diagrams', expected: false },
  ])('reports hasMermaid=$expected for $name', ({ content, expected }) => {
    expect(forContent(content).hasMermaid).toBe(expected);
  });

  it.each([
    { name: 'a threshold colour', content: '<span style="color:${__data.fields.cpu.color}">x</span>', expected: true },
    { name: 'the value colour', content: '${__value.color}', expected: true },
    { name: 'the value text alone', content: '${__data.fields.cpu}', expected: false },
    { name: 'a CSS colour', content: '<span style="color:red">x</span>', expected: false },
  ])('reports referencesColor=$expected for $name', ({ content, expected }) => {
    expect(forContent(content).referencesColor).toBe(expected);
  });

  it('reports configured value mappings', () => {
    const mappings: ValueMapping[] = [
      { type: MappingType.ValueToText, options: { ok: { text: 'Healthy', index: 0 } } },
    ];

    expect(forFieldConfig({ mappings }).hasValueMappings).toBe(true);
    expect(forFieldConfig({}).hasValueMappings).toBe(false);
  });

  it('passes the editing session through unchanged', () => {
    const props = deriveSavedProperties(
      snapshot({
        newFeaturesEnabled: false,
        hasData: true,
        editorViewAtSave: 'split',
        editorViewChanged: true,
        contentChanged: true,
      })
    );

    expect(props).toMatchObject({
      newFeaturesEnabled: false,
      hasData: true,
      editorViewAtSave: 'split',
      editorViewChanged: true,
      contentChanged: true,
    });
  });
});

describe('TextPanelSaveTracker', () => {
  let tracker: TextPanelSaveTracker;

  beforeEach(() => {
    saved.mockClear();
    tracker = new TextPanelSaveTracker();
  });

  it('reports one event per edited panel when the dashboard is saved', () => {
    tracker.record(1, withContent('# Plain'));
    tracker.record(2, withContent('{{host}}'));

    appEvents.publish(new DashboardSavedEvent());

    expect(saved).toHaveBeenCalledTimes(2);
    expect(saved).toHaveBeenNthCalledWith(1, expect.objectContaining({ hasHandlebars: false }));
    expect(saved).toHaveBeenNthCalledWith(2, expect.objectContaining({ hasHandlebars: true }));
  });

  it('reports nothing for a dashboard where no text panel was edited', () => {
    appEvents.publish(new DashboardSavedEvent());

    expect(saved).not.toHaveBeenCalled();
  });

  it('reports the panel as it looked when last recorded', () => {
    tracker.record(1, withContent('draft'));
    tracker.record(1, withContent('{{#each data}}{{host}}{{/each}}', { editorViewAtSave: 'split' }));

    appEvents.publish(new DashboardSavedEvent());

    expect(saved).toHaveBeenCalledTimes(1);
    expect(saved).toHaveBeenCalledWith(expect.objectContaining({ hasHandlebars: true, editorViewAtSave: 'split' }));
  });

  it('drops the config when the author discards, so a later save still reports nothing', () => {
    tracker.record(1, withContent('# Abandoned'));

    appEvents.publish(new DashboardDiscardedEvent());
    expect(saved).not.toHaveBeenCalled();

    appEvents.publish(new DashboardSavedEvent());
    expect(saved).not.toHaveBeenCalled();
  });

  it('does not report a panel that was forgotten, so an unchanged panel cannot leak to a later save', () => {
    tracker.record(1, withContent('# Opened'));
    tracker.record(2, withContent('{{host}}'));

    tracker.forget(1);
    appEvents.publish(new DashboardSavedEvent());

    expect(saved).toHaveBeenCalledTimes(1);
    expect(saved).toHaveBeenCalledWith(expect.objectContaining({ hasHandlebars: true }));
  });

  it('does not report the same panel again on a second save', () => {
    tracker.record(1, withContent('# Once'));

    appEvents.publish(new DashboardSavedEvent());

    appEvents.publish(new DashboardSavedEvent());

    expect(saved).toHaveBeenCalledTimes(1);
  });
});
