import { css } from '@emotion/css';

import { GrafanaTheme2, InternalTimeZones, StandardEditorProps } from '@grafana/data';
import { t } from '@grafana/i18n';
import { OptionsWithTimezones } from '@grafana/schema';
import { IconButton, TimeZonePicker, useStyles2 } from '@grafana/ui';

type Props = StandardEditorProps<string[], unknown, OptionsWithTimezones>;

export const TimezonesEditor = ({ value, onChange }: Props) => {
  const styles = useStyles2(getStyles);

  if (!value || value.length < 1) {
    value = [''];
  }

  const addTimezone = () => {
    onChange([...value, InternalTimeZones.default]);
  };

  const removeTimezone = (idx: number) => {
    const copy = value.slice();
    copy.splice(idx, 1);
    onChange(copy);
  };

  const setTimezone = (idx: number, tz?: string) => {
    const copy = value.slice();
    copy[idx] = tz ?? InternalTimeZones.default;
    if (copy.length === 0 || (copy.length === 1 && copy[0] === '')) {
      onChange(undefined);
    } else {
      onChange(copy);
    }
  };

  return (
    <ul className={styles.list}>
      {value.map((tz, idx) => (
        <li className={styles.listItem} key={`${idx}.${tz}`}>
          <TimeZonePicker
            onChange={(v) => setTimezone(idx, v)}
            includeInternal={true}
            value={tz ?? InternalTimeZones.default}
          />
          {idx === value.length - 1 ? (
            <IconButton
              name="plus"
              onClick={addTimezone}
              tooltip={t('timeseries.timezones-editor.tooltip-add-timezone', 'Add timezone')}
            />
          ) : (
            <IconButton
              name="times"
              onClick={() => removeTimezone(idx)}
              tooltip={t('timeseries.timezones-editor.tooltip-remove-timezone', 'Remove timezone')}
            />
          )}
        </li>
      ))}
    </ul>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  list: css({
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
  }),
  listItem: css({
    display: 'flex',
    gap: theme.spacing(1),
  }),
});
