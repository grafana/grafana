import { type StoryFn, type Meta } from '@storybook/react';
import { action } from 'storybook/actions';

import { StoryExample } from '../../utils/storybook/StoryExample';
import { type AlertVariant } from '../Alert/Alert';
import { Stack } from '../Layout/Stack/Stack';

import { AlertBanner } from './AlertBanner';

const severities: AlertVariant[] = ['error', 'warning', 'info', 'success'];

const meta: Meta = {
  title: 'Information/AlertBanner',
  component: AlertBanner,
  parameters: {
    controls: { exclude: ['onRemove', 'action'] },
  },
  argTypes: {
    severity: {
      control: { type: 'select', options: severities },
    },
  },
};

export const Basic: StoryFn<typeof AlertBanner> = (args) => {
  return (
    <div>
      <AlertBanner {...args}>
        Child content that includes some alert details, like maybe what actually happened.
      </AlertBanner>
    </div>
  );
};

Basic.args = {
  severity: 'error',
  title: 'Basic',
};

export const Examples: StoryFn<typeof AlertBanner> = () => {
  return (
    <Stack direction="column">
      <StoryExample name="With buttonContent and children">
        <AlertBanner
          title={'The title of the alert'}
          severity={'error'}
          buttonContent={<span>Close</span>}
          onRemove={action('Remove button clicked')}
        >
          Child content that includes some alert details, like maybe what actually happened
        </AlertBanner>
      </StoryExample>
      <StoryExample name="No dismiss">
        <AlertBanner title={'No dismiss'} severity={'success'} />
      </StoryExample>
      <StoryExample name="Severities">
        <Stack direction="column">
          {severities.map((severity) => (
            <AlertBanner title={`Severity: ${severity}`} severity={severity} key={severity}>
              Child content
            </AlertBanner>
          ))}
        </Stack>
      </StoryExample>
    </Stack>
  );
};

export const WithActionAndDismiss: StoryFn<typeof AlertBanner> = (args) => {
  return (
    <AlertBanner {...args}>You have reached your quota limit. Request an increase or dismiss this alert.</AlertBanner>
  );
};

WithActionAndDismiss.args = {
  title: 'Quota limit reached',
  severity: 'warning',
  action: action('Action button clicked'),
  actionLabel: 'Request increase',
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

const ActionOnlyAlertBanner = ({ severity }: { severity: AlertVariant }) => {
  const { title, body, actionLabel } = actionOnlyExamples[severity];

  return (
    <AlertBanner title={title} severity={severity} action={action('Action button clicked')} actionLabel={actionLabel}>
      {body}
    </AlertBanner>
  );
};

export const WithActionOnly: StoryFn<typeof AlertBanner> = (args) => {
  return (
    <Stack direction="column">
      <AlertBanner {...args}>The rule you are trying to copy does not exist.</AlertBanner>
      {severities
        .filter((severity) => severity !== 'error')
        .map((severity) => (
          <ActionOnlyAlertBanner severity={severity} key={severity} />
        ))}
    </Stack>
  );
};

WithActionOnly.args = {
  title: 'Cannot copy the rule',
  severity: 'error',
  action: action('Action button clicked'),
  actionLabel: 'Go back to alert list',
};

export const WithActionAndRemoveButton: StoryFn<typeof AlertBanner> = (args) => {
  return (
    <Stack direction="column">
      <AlertBanner {...args}>This alert has both a custom action and a remove button with custom content.</AlertBanner>
      {severities
        .filter((severity) => severity !== args.severity)
        .map((severity) => (
          <AlertBanner {...args} severity={severity} key={severity}>
            This alert has both a custom action and a remove button with custom content.
          </AlertBanner>
        ))}
    </Stack>
  );
};

WithActionAndRemoveButton.args = {
  title: 'Multiple actions',
  severity: 'info',
  action: action('Action button clicked'),
  actionLabel: 'View docs',
  onRemove: action('Remove button clicked'),
  buttonContent: 'Dismiss',
};

export const Toast: StoryFn<typeof AlertBanner> = (args) => {
  return <AlertBanner {...args}>To use as a toast, set the elevated and onRemove props.</AlertBanner>;
};

Toast.args = {
  title: 'Toast',
  severity: 'error',
  onRemove: action('Remove button clicked'),
  elevated: true,
};

export default meta;
