import { type Meta, type StoryObj } from '@storybook/react';

import { CodeMirrorDiffEditor } from './DiffEditorLazy';
import { CODE_MIRROR_LANGUAGES } from './languages';

const meta: Meta<typeof CodeMirrorDiffEditor> = {
  title: 'Inputs/CodeMirrorDiffEditor',
  component: CodeMirrorDiffEditor,
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

type Story = StoryObj<typeof CodeMirrorDiffEditor>;

export const SideBySide: Story = {};
export const Inline: Story = { args: { inline: true } };
