import { type StoryFn, type Meta } from '@storybook/react';
import { action } from 'storybook/actions';

import { StoryExample } from '../../utils/storybook/StoryExample';
import { Button } from '../Button/Button';
import { Stack } from '../Layout/Stack/Stack';

import { Alert, type AlertVariant } from './Alert';
import mdx from './Alert.mdx';

const severities: AlertVariant[] = ['error', 'warning', 'info', 'success'];

const meta: Meta = {
  title: 'Information/Alert',
  component: Alert,
  parameters: {
    docs: {
      page: mdx,
    },
    controls: { exclude: ['onRemove', 'action'] },
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

export const WithActionAndDismiss: StoryFn<typeof Alert> = (args) => {
  return <Alert {...args}>You have reached your quota limit. Request an increase or dismiss this alert.</Alert>;
};

WithActionAndDismiss.args = {
  title: 'Quota limit reached',
  severity: 'warning',
  action: (
    <Button variant="secondary" onClick={action('Action button clicked')}>
      Request increase
    </Button>
  ),
  onRemove: action('Dismiss button clicked'),
};

const actionOnlyExamples: Record<AlertVariant, { title: string; body: string; actionLabel: string }> = {
  error: {
    title: 'Cannot copy the rule',
    body: 'The rule you are trying to copy does not exist.',
    actionLabel: 'Go back to alert list',
  },
  warning: {
    title: 'Quota almost reached',
    body: 'You have used 90% of your monthly quota.',
    actionLabel: 'Request increase',
  },
  info: {
    title: 'New version available',
    body: 'A newer version of this plugin is available.',
    actionLabel: 'View changes',
  },
  success: {
    title: 'Rule copied',
    body: 'The rule was copied to the selected folder.',
    actionLabel: 'Open rule',
  },
};

const ActionOnlyAlert = ({ severity }: { severity: AlertVariant }) => {
  const { title, body, actionLabel } = actionOnlyExamples[severity];

  return (
    <Alert
      title={title}
      severity={severity}
      action={
        <Button variant="secondary" onClick={action('Action button clicked')}>
          {actionLabel}
        </Button>
      }
    >
      {body}
    </Alert>
  );
};

export const WithActionOnly: StoryFn<typeof Alert> = (args) => {
  return (
    <Stack direction="column">
      <Alert {...args}>The rule you are trying to copy does not exist.</Alert>
      {severities
        .filter((severity) => severity !== 'error')
        .map((severity) => (
          <ActionOnlyAlert severity={severity} key={severity} />
        ))}
    </Stack>
  );
};

WithActionOnly.args = {
  title: 'Cannot copy the rule',
  severity: 'error',
  action: (
    <Button variant="secondary" onClick={action('Action button clicked')}>
      Go back to alert list
    </Button>
  ),
};

export const WithActionAndRemoveButton: StoryFn<typeof Alert> = (args) => {
  return (
    <Stack direction="column">
      <Alert {...args}>This alert has both a custom action and a remove button with custom content.</Alert>
      {severities
        .filter((severity) => severity !== args.severity)
        .map((severity) => (
          <Alert {...args} severity={severity} key={severity}>
            This alert has both a custom action and a remove button with custom content.
          </Alert>
        ))}
    </Stack>
  );
};

WithActionAndRemoveButton.args = {
  title: 'Multiple actions',
  severity: 'info',
  action: (
    <Button variant="primary" onClick={action('Action button clicked')}>
      View docs
    </Button>
  ),
  onRemove: action('Remove button clicked'),
  buttonContent: 'Dismiss',
};

export const Toast: StoryFn<typeof Alert> = (args) => {
  return <Alert {...args}>To use as a toast, set the elevated and onRemove props.</Alert>;
};

Toast.args = {
  title: 'Toast',
  severity: 'error',
  onRemove: action('Remove button clicked'),
  elevated: true,
};

export default meta;
