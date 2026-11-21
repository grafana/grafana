import { render } from '@testing-library/react';

import { PanelStatusStore } from '@grafana/data/internal';
import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { PanelContextProvider, type PanelContext } from '@grafana/ui';

import { RenderMode, TextMode } from '../panelcfg.gen';

import { TextFmtDeprecationNotice } from './TextFmtDeprecationNotice';

const NOTICE = 'This panel reads fmt, which is deprecated. Edit the panel to convert it to the display helper.';

let notices: PanelStatusStore;

function setup({
  content = '{{#each data}}{{fmt.cpu}}{{/each}}',
  mode = TextMode.Markdown,
}: { content?: string; mode?: TextMode } = {}) {
  notices = new PanelStatusStore();

  return render(
    <PanelContextProvider value={{ notices } as unknown as PanelContext}>
      <TextFmtDeprecationNotice content={content} mode={mode} renderMode={RenderMode.Once} />
    </PanelContextProvider>
  );
}

beforeEach(() => {
  setTestFlags({ [FlagKeys.TextNewFeatures]: true });
});

afterAll(() => {
  setTestFlags({});
});

it('publishes a warning that the template reads fmt', () => {
  setup();

  const items = notices.getSnapshot().items;
  expect(items).toHaveLength(1);
  expect(items[0]).toEqual({
    id: expect.any(String),
    actions: [],
    origin: 'panel',
    severity: 'warning',
    text: NOTICE,
    assistant: 'hidden',
  });
});

it('warns about reads it cannot convert too, so they get changed by hand', () => {
  setup({ content: '{{#each data}}{{#each fmt}}{{this}}{{/each}}{{/each}}' });

  expect(notices.getSnapshot().items.map((item) => item.text)).toEqual([NOTICE]);
});

it.each([
  { desc: 'a template without fmt reads', props: { content: '{{#each data}}{{display "cpu"}}{{/each}}' } },
  { desc: 'fmt in an HTML comment, which the panel shows as text', props: { content: '<!-- {{fmt.cpu}} -->' } },
  { desc: 'Code mode, which shows the template as text', props: { mode: TextMode.Code } },
])('publishes nothing for $desc', ({ props }) => {
  setup(props);

  expect(notices.getSnapshot().items).toEqual([]);
});

it('publishes nothing while the text.newFeatures flag is off, since Handlebars does not run', () => {
  setTestFlags({ [FlagKeys.TextNewFeatures]: false });
  setup();

  expect(notices.getSnapshot().items).toEqual([]);
});
