import { useFormContext } from 'react-hook-form';

import { Checkbox, Field } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { CommonSettingsComponentProps } from '../../../types/receiver-form';

export const GrafanaCommonChannelSettings = ({
  pathPrefix,
  className,
  readOnly = false,
}: CommonSettingsComponentProps) => {
  const { register } = useFormContext();
  return (
    <div className={className}>
      <Field>
        <Checkbox
          {...register(`${pathPrefix}disableResolveMessage`)}
          label={t(
            'alerting.grafana-common-channel-settings.label-disable-resolved-message',
            'Disable resolved message'
          )}
          description={t(
            'alerting.grafana-common-channel-settings.description-disable-resolved-message',
            'Disable the resolve message [OK] that is sent when alerting state returns to false'
          )}
          disabled={readOnly}
        />
      </Field>
    </div>
  );
};
