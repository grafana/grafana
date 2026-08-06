import { fireEvent, screen } from '@testing-library/react';

import { CoreApp } from '@grafana/data';

import { TextMode } from '../panelcfg.gen';

import { createInlineEditChannel, createProps, renderPanel, type RenderPanelOptions } from './test-utils';

// Stub the lazy CodeMirror bundle used by the inline editor.
jest.mock('@grafana/ui/unstable', () => ({
  ...jest.requireActual('@grafana/ui/unstable'),
  CodeMirrorEditor: ({ value, 'aria-label': ariaLabel }: { value: string; 'aria-label'?: string }) => (
    <textarea aria-label={ariaLabel} value={value} readOnly />
  ),
}));

function setup(canEditInline = true, options: Omit<RenderPanelOptions, 'inlineEdit'> = {}) {
  const props = createProps((str: string) => str, {
    options: { content: '# Hello', mode: TextMode.Markdown },
  });
  const channel = createInlineEditChannel(canEditInline);

  const result = renderPanel(props, CoreApp.Dashboard, {
    inlineEditFlag: true,
    ...options,
    inlineEdit: channel.channel,
  });

  return { ...result, ...channel, props };
}

const editor = () => screen.queryByTestId('TextNGEditor');
const rendered = () => screen.queryByTestId('TextNGPanel-converted-content');

describe('TextNGPanel inline editing', () => {
  it('swaps the panel body for the editor when the host says it may be edited', async () => {
    setup();

    expect(await screen.findByTestId('TextNGEditor')).toBeInTheDocument();
    expect(rendered()).not.toBeInTheDocument();
  });

  it('renders content when the host says it may not be edited', () => {
    setup(false);

    expect(editor()).not.toBeInTheDocument();
    expect(rendered()).toBeInTheDocument();
  });

  it('renders content when the feature flag is off', () => {
    setup(true, { inlineEditFlag: false });

    expect(editor()).not.toBeInTheDocument();
    expect(rendered()).toBeInTheDocument();
  });

  it('renders content when the host provides no inline edit channel', () => {
    const props = createProps((str: string) => str, { options: { content: '# Hello', mode: TextMode.Markdown } });

    renderPanel(props, CoreApp.Dashboard, { inlineEditFlag: true });

    expect(editor()).not.toBeInTheDocument();
    expect(rendered()).toBeInTheDocument();
  });

  it('leaves the panel editor as the only editing path when it is open', async () => {
    const props = createProps((str: string) => str, { options: { content: '# Hello', mode: TextMode.Markdown } });

    renderPanel(props, CoreApp.PanelEditor, {
      inlineEdit: createInlineEditChannel(false).channel,
      inlineEditFlag: true,
    });

    expect(await screen.findByTestId('TextNGEditor')).toBeInTheDocument();
  });

  it('opens and closes the editor as the selection changes', async () => {
    const { set } = setup(false);

    set(true);
    expect(await screen.findByTestId('TextNGEditor')).toBeInTheDocument();

    set(false);
    expect(editor()).not.toBeInTheDocument();
    expect(rendered()).toBeInTheDocument();
  });

  it('shows the edited content immediately after being deselected', async () => {
    const { set, props, rerenderPanel } = setup();
    expect(await screen.findByTestId('TextNGEditor')).toBeInTheDocument();

    // The dashboard blurs the editor before it changes the selection, so the committed options
    // arrive first and the deselect follows.
    rerenderPanel({ ...props, options: { content: '# Edited', mode: TextMode.Markdown } });
    set(false);

    // The debounce that applies while the editor owns rendering must not delay this, or the panel
    // would flash its pre-edit content.
    expect(screen.getByTestId('TextNGPanel-converted-content').innerHTML).toContain('Edited');
  });

  it('runs one host edit session per editing session', async () => {
    const { set, props, rerenderPanel, beginOptionsEditSession, endSession } = setup();
    expect(await screen.findByTestId('TextNGEditor')).toBeInTheDocument();
    expect(beginOptionsEditSession).toHaveBeenCalledTimes(1);

    // Two commits within one session, as a debounced editor produces while typing.
    rerenderPanel({ ...props, options: { content: '# Hel', mode: TextMode.Markdown } });
    rerenderPanel({ ...props, options: { content: '# Edited', mode: TextMode.Markdown } });
    expect(endSession).not.toHaveBeenCalled();

    set(false);

    expect(beginOptionsEditSession).toHaveBeenCalledTimes(1);
    expect(endSession).toHaveBeenCalledTimes(1);
  });

  it('opens no edit session when the panel is never editable', () => {
    const { beginOptionsEditSession } = setup(false);

    expect(beginOptionsEditSession).not.toHaveBeenCalled();
  });

  describe('pointer down containment', () => {
    it('stops pointer down from reaching the panel chrome while editing', async () => {
      const onHostPointerDown = jest.fn();
      setup(true, { onHostPointerDown });

      fireEvent.pointerDown(await screen.findByTestId('TextNGEditor'));

      // Selecting an already selected panel deselects it, so a pointer down inside the editor must
      // not reach the chrome or the editor would unmount mid-edit.
      expect(onHostPointerDown).not.toHaveBeenCalled();
    });

    it('lets pointer down through when not editing, so the panel can still be selected', () => {
      const onHostPointerDown = jest.fn();
      setup(false, { onHostPointerDown });

      fireEvent.pointerDown(screen.getByTestId('TextNGPanel-converted-content'));

      expect(onHostPointerDown).toHaveBeenCalled();
    });
  });
});
