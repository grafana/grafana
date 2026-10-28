import { type Meta, type StoryObj } from '@storybook/react';

import { CODE_MIRROR_LANGUAGES } from '../CodeMirror/languages';

import { DiffViewer } from './DiffViewer';
import { InlineDiffToggle, useInlineDiffPreference } from './inlineDiffPreference';

const meta: Meta<typeof DiffViewer> = {
  title: 'Inputs/DiffViewer',
  component: DiffViewer,
  argTypes: {
    language: { control: 'select', options: Object.keys(CODE_MIRROR_LANGUAGES) },
  },
  args: {
    original: '{\n  "title": "Service overview",\n  "refresh": "30s",\n  "tags": ["production"]\n}',
    modified: '{\n  "title": "Service health",\n  "refresh": "10s",\n  "tags": ["production", "on-call"]\n}',
    language: 'json',
    height: '300px',
    lineNumbers: true,
  },
};

export default meta;

type Story = StoryObj<typeof DiffViewer>;

export const Default: Story = {};
export const SideBySide: Story = { args: { inline: false } };
export const Inline: Story = { args: { inline: true } };
export const HeaderToggle: Story = {
  render: function HeaderToggle(args) {
    const [inline, setInline] = useInlineDiffPreference();

    return (
      <>
        <InlineDiffToggle value={inline} onChange={setInline} />
        <DiffViewer {...args} inline={inline} />
      </>
    );
  },
};
