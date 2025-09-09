import type { Meta, StoryObj } from '@storybook/react';
import { ComponentProps } from 'react';

import { Stack } from '@grafana/ui';

import { StateText } from './StateText';
import mdx from './StateText.mdx';

const meta: Meta<typeof StateText> = {
  component: StateText,
  title: 'Rules/StateText',
  decorators: [],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export default meta;

export const AlertRule: StoryObj<typeof StateText> = {
  render: (args: ComponentProps<typeof StateText>) => (
    <Stack direction="column" alignItems="flex-start">
      <StateText {...args} />
      <hr />
      <StateText type="alerting" state="normal" />
      <StateText type="alerting" state="pending" />
      <StateText type="alerting" state="firing" />
      <StateText type="alerting" state="recovering" />
      <StateText type="alerting" state="unknown" />
      <hr />
      <StateText type="alerting" state="firing" health="error" />
      <StateText type="alerting" state="firing" health="nodata" />
    </Stack>
  ),
};

export const RecordingRule: StoryObj<typeof StateText> = {
  render: (args: ComponentProps<typeof StateText>) => (
    <Stack direction="column" alignItems="flex-start">
      <StateText type="recording" health="error" />
      <StateText type="recording" />
    </Stack>
  ),
};
