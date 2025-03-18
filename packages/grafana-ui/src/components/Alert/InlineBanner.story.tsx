import { action } from '@storybook/addon-actions';
import { StoryFn, Meta } from '@storybook/react';

import { Alert, AlertVariant, Stack } from '@grafana/ui';

import { StoryExample } from '../../utils/storybook/StoryExample';

import mdx from './Alert.mdx';

const severities: AlertVariant[] = ['error', 'warning', 'info', 'success'];

const meta: Meta = {
  title: 'Overlays/Alert/InlineBanner',
  component: Alert,
  parameters: {
    docs: {
      page: mdx,
    },
    controls: { exclude: ['onRemove'] },
  },
  argTypes: {
    severity: {
      control: { type: 'select', options: severities },
    },
  },
};

export const Basic: StoryFn<typeof Alert> = (args) => {
  return (
    <div>
      <Alert {...args}>Child content that includes some alert details, like maybe what actually happened.</Alert>
    </div>
  );
};

Basic.args = {
  severity: 'error',
  title: 'Basic',
};

export const WithActions: StoryFn<typeof Alert> = (args) => {
  return <Alert {...args}>Child content that includes some alert details, like maybe what actually happened.</Alert>;
};

WithActions.args = {
  title: 'With action',
  severity: 'error',
  onRemove: action('Remove button clicked'),
  buttonContent: 'Close',
};

export const Examples: StoryFn<typeof Alert> = () => {
  return (
    <Stack direction="column">
      <StoryExample name="With buttonContent and children">
        <Alert
          title={'The title of the alert'}
          severity={'error'}
          buttonContent={<span>Close</span>}
          onRemove={action('Remove button clicked')}
        >
          Child content that includes some alert details, like maybe what actually happened
        </Alert>
      </StoryExample>
      <StoryExample name="No dismiss">
        <Alert title={'No dismiss'} severity={'success'} />
      </StoryExample>
      <StoryExample name="Severities">
        <Stack direction="column">
          {severities.map((severity) => (
            <Alert title={`Severity: ${severity}`} severity={severity} key={severity}>
              Child content
            </Alert>
          ))}
        </Stack>
      </StoryExample>
    </Stack>
  );
};

export default meta;
