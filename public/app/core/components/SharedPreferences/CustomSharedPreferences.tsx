import { css } from '@emotion/css';
import { FC } from 'react';

import { GrafanaTheme2, SelectableValue, localTimeFormat } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Field, Label, Select, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

const dataTestId = {
  dateTimeFormat: 'data-testid Choose Date Time Format',
};

type CustomDateFormatPickerProps = {
  value?: string;
  onChange: (value: string) => void;
  resourceUri?: string;
};
export const CustomDateFormatPicker: FC<CustomDateFormatPickerProps> = ({ value, onChange, resourceUri }) => {
  const styles = useStyles2(getStyles);

  const systemTimeFormat = localTimeFormat({
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const { useBrowserLocale, fullDate } = config.bootData.settings.dateFormats ?? {};

  const options: SelectableValue[] = [
    {
      label: t('common.locale.default', 'Default'),
      description:
        resourceUri !== 'org'
          ? 'Defaults to org. setting'
          : resourceUri === 'org' || useBrowserLocale
            ? systemTimeFormat
            : fullDate,
      value: '',
    },
    { label: `Datetime locale`, description: systemTimeFormat, value: 'browser' },
    { label: 'Datetime ISO', description: 'YYYY-MM-DD HH:mm:ss', value: 'YYYY-MM-DD HH:mm:ss' },
    { label: 'Datetime US', description: 'MM/DD/YYYY hh:mm:ss A', value: 'MM/DD/YYYY hh:mm:ss A' },
    { label: 'Datetime UK / FR', description: 'DD/MM/YYYY HH:mm:ss', value: 'DD/MM/YYYY HH:mm:ss' },
    { label: 'Datetime ES', description: 'DD/MM/YYYY, HH:mm:ss', value: 'DD/MM/YYYY, HH:mm:ss' },
    { label: 'Datetime DE', description: 'DD.MM.YYYY HH:mm:ss', value: 'DD.MM.YYYY HH:mm:ss' },
    { label: 'Datetime JP', description: 'YYYY/MM/DD HH:mm:ss', value: 'YYYY/MM/DD HH:mm:ss' },
    { label: 'Datetime CN', description: 'YYYY年MM月DD日 HH时mm分ss秒', value: 'YYYY年MM月DD日 HH时mm分ss秒' },
  ];

  const description = () => {
    let labelDescription = `${t(
      'bmc.shared-preferences.datetime-format.description',
      `This will change the default time format used in dashboards, panels and reports.`
    )}`;
    // if (exampleTimeFormat) {
    //   labelDescription += ` eg. ${exampleTimeFormat}`;
    // }
    return labelDescription;
  };

  return (
    <Field
      label={
        <Label htmlFor="datetime-format" description={description()}>
          <span className={styles.labelText}>
            <Trans i18nKey="bmc.shared-preferences.datetime-format.label">Datetime Format</Trans>
          </span>
        </Label>
      }
      data-testid={dataTestId.dateTimeFormat}
    >
      <Select
        //BMC Accessibility Change : Replaced id by inputId.
        inputId="datetime-format"
        options={[
          ...options,
          ...(value && !options.find((option) => option.value === value)
            ? [{ label: 'Custom', description: value, value }]
            : []),
        ]}
        value={value}
        defaultValue={''}
        onChange={(timeformat) => onChange(timeformat.value ?? 'browser')}
        allowCustomValue
        isSearchable
      />
    </Field>
  );
};

function getStyles(_: GrafanaTheme2) {
  return {
    labelText: css({
      marginRight: '6px',
    }),
  };
}
