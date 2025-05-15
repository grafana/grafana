import { useFormContext } from 'react-hook-form';

import { useTranslate } from '@grafana/i18n';
import { Checkbox, Field } from '@grafana/ui';

import { CommonSettingsComponentProps } from '../../../types/receiver-form';

export const GrafanaCommonChannelSettings = ({
  pathPrefix,
  className,
  readOnly = false,
}: CommonSettingsComponentProps) => {
  const { register } = useFormContext();
  const { t } = useTranslate();
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
