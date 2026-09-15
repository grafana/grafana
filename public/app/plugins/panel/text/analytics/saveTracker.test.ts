import { type FieldConfigSource, MappingType, type ValueMapping } from '@grafana/data';
import { locationService } from '@grafana/runtime';
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
    content: '',
    options: { mode: TextMode.Markdown, content: '', renderMode: RenderMode.Once },
    fieldConfig: { defaults: {}, overrides: [] },
    newFeaturesEnabled: true,
    hasData: false,
    editorViewAtSave: 'preview',
    editorViewChanged: false,
    ...overrides,
  };
}

function withContent(content: string, overrides: Partial<TextPanelSnapshot> = {}): TextPanelSnapshot {
  return snapshot({
    content,
    options: { mode: TextMode.Markdown, content, renderMode: RenderMode.Once },
    ...overrides,
  });
}

function forContent(content: string, options: Partial<Options> = {}) {
  const snap = snapshot({
    content,
    options: { mode: TextMode.Markdown, content, renderMode: RenderMode.Once, ...options },
  });
  return deriveSavedProperties(snap);
}

function forFieldConfig(defaults: FieldConfigSource['defaults'], overrides: FieldConfigSource['overrides'] = []) {
  const snap = snapshot({ fieldConfig: { defaults, overrides } });
  return deriveSavedProperties(snap);
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
    const snap = snapshot({ options: { mode: TextMode.Markdown, content: '' } });

    expect(deriveSavedProperties(snap).renderMode).toBe(RenderMode.Once);
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

  it('counts value mappings set as a field override, which reach the value just as the defaults do', () => {
    const mappings: ValueMapping[] = [
      { type: MappingType.ValueToText, options: { ok: { text: 'Healthy', index: 0 } } },
    ];
    const overrides = [
      { matcher: { id: 'byName', options: 'cpu' }, properties: [{ id: 'mappings', value: mappings }] },
    ];

    expect(forFieldConfig({}, overrides).hasValueMappings).toBe(true);
    expect(forFieldConfig({}, [{ matcher: { id: 'byName', options: 'cpu' }, properties: [] }]).hasValueMappings).toBe(
      false
    );
  });

  it('passes the editing session through unchanged', () => {
    const snap = snapshot({
      newFeaturesEnabled: false,
      hasData: true,
      editorViewAtSave: 'split',
      editorViewChanged: true,
    });

    expect(deriveSavedProperties(snap)).toMatchObject({
      newFeaturesEnabled: false,
      hasData: true,
      editorViewAtSave: 'split',
      editorViewChanged: true,
    });
  });
});

describe('TextPanelSaveTracker', () => {
  let tracker: TextPanelSaveTracker;

  beforeEach(() => {
    saved.mockClear();
    locationService.push('/d/dash-a/a');
    tracker = new TextPanelSaveTracker();
  });

  /** The first record of a session is the panel as the author found it, and gates the rest. */
  const open = (panelId: number, snap: TextPanelSnapshot) => tracker.record(panelId, snap);

  it('reports one event per changed panel when the dashboard is saved', () => {
    open(1, withContent('# Plain'));
    open(2, withContent('# Plain'));
    tracker.record(1, withContent('# Plain, edited'));
    tracker.record(2, withContent('{{host}}'));

    appEvents.publish(new DashboardSavedEvent());

    expect(saved).toHaveBeenCalledTimes(2);
    expect(saved).toHaveBeenNthCalledWith(1, expect.objectContaining({ hasHandlebars: false }));
    expect(saved).toHaveBeenNthCalledWith(2, expect.objectContaining({ hasHandlebars: true }));
  });

  it('reports nothing for a panel the author opened but did not change', () => {
    open(1, withContent('# Untouched'));
    tracker.record(
      1,
      withContent('# Untouched', { editorViewAtSave: 'write', editorViewChanged: true, hasData: true })
    );

    appEvents.publish(new DashboardSavedEvent());

    expect(saved).not.toHaveBeenCalled();
  });

  it('reports nothing once the author reverts the edit', () => {
    open(1, withContent('# Start'));
    tracker.record(1, withContent('# Edited'));
    tracker.record(1, withContent('# Start'));

    appEvents.publish(new DashboardSavedEvent());

    expect(saved).not.toHaveBeenCalled();
  });

  it('reports nothing for a dashboard where no text panel was opened', () => {
    appEvents.publish(new DashboardSavedEvent());

    expect(saved).not.toHaveBeenCalled();
  });

  it('reports a field config edit', () => {
    const mappings: ValueMapping[] = [
      { type: MappingType.ValueToText, options: { ok: { text: 'Healthy', index: 0 } } },
    ];
    open(1, withContent('# Same'));
    tracker.record(1, withContent('# Same', { fieldConfig: { defaults: { mappings }, overrides: [] } }));

    appEvents.publish(new DashboardSavedEvent());

    expect(saved).toHaveBeenCalledWith(expect.objectContaining({ hasValueMappings: true }));
  });

  it('reports the panel as it looked when last recorded', () => {
    open(1, withContent('draft'));
    tracker.record(1, withContent('draft, again'));
    tracker.record(1, withContent('{{#each data}}{{host}}{{/each}}', { editorViewAtSave: 'split' }));

    appEvents.publish(new DashboardSavedEvent());

    expect(saved).toHaveBeenCalledTimes(1);
    expect(saved).toHaveBeenCalledWith(expect.objectContaining({ hasHandlebars: true, editorViewAtSave: 'split' }));
  });

  it('drops the config when the author discards, so a later save still reports nothing', () => {
    open(1, withContent('# Start'));
    tracker.record(1, withContent('# Abandoned'));

    appEvents.publish(new DashboardDiscardedEvent());
    expect(saved).not.toHaveBeenCalled();

    appEvents.publish(new DashboardSavedEvent());
    expect(saved).not.toHaveBeenCalled();
  });

  // Reopening replays the edited state as the session's first record.
  it('still reports a panel whose editor was reopened after the edit', () => {
    open(1, withContent('# Start'));
    tracker.record(1, withContent('# Edited'));
    tracker.record(1, withContent('# Edited'));

    appEvents.publish(new DashboardSavedEvent());

    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('reports nothing for a panel whose edit was discarded in the panel editor', () => {
    open(1, withContent('# Start'));
    tracker.record(1, withContent('# Abandoned'));

    tracker.forget(1);
    appEvents.publish(new DashboardSavedEvent());

    expect(saved).not.toHaveBeenCalled();
  });

  it('still reports the other panels when one panel edit is discarded', () => {
    open(1, withContent('# Start'));
    open(2, withContent('# Start'));
    tracker.record(1, withContent('# Abandoned'));
    tracker.record(2, withContent('{{host}}'));

    tracker.forget(1);
    appEvents.publish(new DashboardSavedEvent());

    expect(saved).toHaveBeenCalledTimes(1);
    expect(saved).toHaveBeenCalledWith(expect.objectContaining({ hasHandlebars: true }));
  });

  it('does not report the same edit again on a later save', () => {
    open(1, withContent('# Start'));
    tracker.record(1, withContent('# Edited'));

    appEvents.publish(new DashboardSavedEvent());
    expect(saved).toHaveBeenCalledTimes(1);

    tracker.record(1, withContent('# Edited'));
    appEvents.publish(new DashboardSavedEvent());

    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('reports a further edit made after an earlier save', () => {
    open(1, withContent('# Start'));
    tracker.record(1, withContent('# First edit'));
    appEvents.publish(new DashboardSavedEvent());

    tracker.record(1, withContent('# Second edit'));
    appEvents.publish(new DashboardSavedEvent());

    expect(saved).toHaveBeenCalledTimes(2);
  });

  it('reports a panel first edited after a save made for some other change', () => {
    open(1, withContent('# Start'));
    appEvents.publish(new DashboardSavedEvent());
    expect(saved).not.toHaveBeenCalled();

    tracker.record(1, withContent('# Edited'));
    appEvents.publish(new DashboardSavedEvent());

    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('drops what it recorded when the author moves to another dashboard', () => {
    open(1, withContent('# Dashboard A panel'));
    tracker.record(1, withContent('# Dashboard A edited'));

    locationService.push('/d/dash-b/b');
    open(1, withContent('# Dashboard B panel'));

    appEvents.publish(new DashboardSavedEvent());

    expect(saved).not.toHaveBeenCalled();
  });

  it('reports nothing when the save belongs to a dashboard it recorded nothing for', () => {
    open(1, withContent('# Dashboard A panel'));
    tracker.record(1, withContent('# Dashboard A edited'));

    locationService.push('/d/dash-b/b');
    appEvents.publish(new DashboardSavedEvent());

    expect(saved).not.toHaveBeenCalled();
  });
});
