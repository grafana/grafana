import { debounce } from 'lodash';
import appEvents from 'app/core/app_events';
import { AppNotificationTimeout } from 'app/types';

const debouncedAlert = debounce(
  () =>
    appEvents.emit('alert-error', [
      'Cloudwatch request limit reached',
      `Please visit https://docs.aws.amazon.com/general/latest/gr/aws_service_limits.html#limits_cloudwatch to extend your limit.`,
    ]),
  AppNotificationTimeout.Error,
  {
    leading: true,
    trailing: true,
  }
);

export const displayThrottlingError = () => {
  debouncedAlert();
};
