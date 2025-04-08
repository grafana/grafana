import { useFormContext } from 'react-hook-form';

import { Checkbox, Field } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { CommonSettingsComponentProps } from '../../../types/receiver-form';

export const CloudCommonChannelSettings = ({
  pathPrefix,
  className,
  readOnly = false,
}: CommonSettingsComponentProps) => {
  const { register } = useFormContext();
  return (
    <div className={className}>
      <Field disabled={readOnly}>
        <Checkbox
          {...register(`${pathPrefix}sendResolved`)}
          label={t('alerting.cloud-common-channel-settings.label-send-resolved', 'Send resolved')}
          disabled={readOnly}
          description={t(
            'alerting.cloud-common-channel-settings.description-whether-notify-about-resolved-alerts',
            'Whether or not to notify about resolved alerts.'
          )}
        />
      </Field>
    </div>
  );
};
