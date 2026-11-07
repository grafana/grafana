import { type Meta, type StoryFn } from '@storybook/react';

import { renderMarkdown } from '@grafana/data';

import { MarkdownHTML } from './MarkdownHTML';

const meta: Meta<typeof MarkdownHTML> = {
  title: 'Information/MarkdownHTML',
  component: MarkdownHTML,
};

export const Admonitions: StoryFn<typeof MarkdownHTML> = () => (
  <MarkdownHTML
    html={renderMarkdown(
      ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION']
        .map(
          (kind) =>
            `> [!${kind}]\n> **Formatted text**, [links](https://grafana.com), and lists:\n>\n> - First item\n> - Second item`
        )
        .join('\n\n')
    )}
  />
);

export default meta;
