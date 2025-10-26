import { Meta, StoryFn } from '@storybook/react';

import { FeatureState } from '@grafana/data';

import { Stack } from '../Layout/Stack/Stack';

import { FeatureInfoBox, FeatureInfoBoxProps } from './FeatureInfoBox';
import { InfoBox } from './InfoBox';
import mdx from './InfoBox.mdx';

const meta: Meta = {
  title: 'Information/Deprecated/InfoBox',
  component: InfoBox,
  decorators: [],
  parameters: {
    docs: {
      page: mdx,
    },
    knobs: {
      disable: true,
    },
    controls: {
      exclude: ['onDismiss', 'children'],
    },
  },
  argTypes: {
    featureState: {
      control: { type: 'select', options: ['experimental', 'preview'] },
    },
  },
};

const defaultProps: FeatureInfoBoxProps = {
  title: 'A title',
  severity: 'info',
  url: 'http://www.grafana.com',
  featureState: FeatureState.preview,

  children: (
    <p>
      The database user should only be granted SELECT permissions on the specified database &amp; tables you want to
      query. Grafana does not validate that queries are safe so queries can contain any SQL statement. For example,
      statements like <code>USE otherdb;</code> and <code>DROP TABLE user;</code> would be executed. To protect against
      this we <strong>Highly</strong> recommend you create a specific MySQL user with restricted permissions.
    </p>
  ),
};

const InfoBoxTemplate: StoryFn<typeof InfoBox> = (args) => {
  return (
    <Stack direction="column">
      <div>Deprecrated component, use Alert with info severity</div>
      <InfoBox {...args} />
    </Stack>
  );
};
export const infoBox = InfoBoxTemplate.bind({});
infoBox.args = defaultProps;

const FeatureInfoBoxTemplate: StoryFn<typeof FeatureInfoBox> = (args) => {
  return (
    <Stack direction="column">
      <div>Deprecrated component, use Alert with info severity</div>
      <FeatureInfoBox {...args} />
    </Stack>
  );
};

export const featureInfoBox = FeatureInfoBoxTemplate.bind({});
featureInfoBox.args = defaultProps;

export default meta;
