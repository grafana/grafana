import { css } from '@emotion/css';
import type { Meta, StoryFn, StoryObj } from '@storybook/react';
import { useState } from 'react';

import { type AlertRuleNotificationSettings } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { type GrafanaTheme2 } from '@grafana/data';
import { InlineSwitch, Stack, useStyles2 } from '@grafana/ui';

import { defaultDecorators } from '../../../../../tests/story-utils';

import {
  NotificationsSettingsSelector,
  type NotificationsSettingsSelectorProps,
  type RecipientMode,
} from './NotificationsSettingsSelector';
import {
  contactPointsListScenario,
  emptyTimeIntervalsScenario,
  routingTreesListScenario,
} from './NotificationsSettingsSelector.scenario';

const meta: Meta<typeof NotificationsSettingsSelector> = {
  component: NotificationsSettingsSelector,
  title: 'Notification Settings/NotificationsSettingsSelector',
  decorators: defaultDecorators,
  // onValidityChange fires from a useEffect on mount, not a user interaction — Storybook's implicit-action
  // auto-mock errors on an unmocked callback firing during render, so provide a no-op.
  args: {
    onValidityChange: () => {},
  },
  parameters: {
    msw: {
      handlers: [...contactPointsListScenario, ...routingTreesListScenario, ...emptyTimeIntervalsScenario],
    },
  },
};

// Standing in for "a consumer with no RuleFormValues context." The toggle lives here (the caller),
// mirroring RuleEditorSection.tsx's switchMode: InlineSwitch, row-reverse, right-aligned.
const StoryRenderFn: StoryFn<NotificationsSettingsSelectorProps> = (args) => {
  const styles = useStyles2(getStyles);
  const [mode, setMode] = useState<RecipientMode>(args.mode);
  const [value, setValue] = useState<AlertRuleNotificationSettings | null>(args.value ?? null);

  return (
    <Stack direction="column" gap={2}>
      <Stack direction="row" justifyContent="flex-end">
        <InlineSwitch
          value={mode === 'notificationPolicy'}
          onChange={(e) => setMode(e.currentTarget.checked ? 'notificationPolicy' : 'contactPoint')}
          label="Advanced options"
          showLabel
          transparent
          className={styles.reverse}
        />
      </Stack>
      <NotificationsSettingsSelector {...args} mode={mode} value={value} onChange={setValue} />
    </Stack>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  reverse: css({
    flexDirection: 'row-reverse',
    gap: theme.spacing(1),
  }),
});

export default meta;
type Story = StoryObj<typeof NotificationsSettingsSelector>;

export const ContactPoint: Story = {
  args: {
    mode: 'contactPoint',
    manageContactPointsHref: '/alerting/notifications',
  },
  render: StoryRenderFn,
};

export const NotificationPolicy: Story = {
  args: {
    mode: 'notificationPolicy',
    viewPoliciesHref: '/alerting/routes',
  },
  render: StoryRenderFn,
};
