export const routeTimingsFields = {
  groupWait: {
    label: 'Group wait',
    description:
      'The waiting time until the initial notification is sent for a new group created by an incoming alert. If empty it will be inherited from the parent policy.',
    ariaLabel: 'Group wait value',
  },
  groupInterval: {
    label: 'Group interval',
    description:
      'The waiting time to send a batch of new alerts for that group after the first notification was sent. If empty it will be inherited from the parent policy.',
    ariaLabel: 'Group interval value',
  },
  repeatInterval: {
    label: 'Repeat interval',
    description: 'The waiting time to resend an alert after they have successfully been sent.',
    ariaLabel: 'Repeat interval value',
  },
};
