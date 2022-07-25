import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, InternalTimeZones, StandardEditorProps } from '@grafana/data';
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
    <div>
      {value.map((tz, idx) => (
        <div className={styles.wrapper} key={`${idx}.${tz}`}>
          <span className={styles.first}>
            <TimeZonePicker
              onChange={(v) => setTimezone(idx, v)}
              includeInternal={true}
              value={tz ?? InternalTimeZones.default}
            />
          </span>
          {idx === value.length - 1 ? (
            <IconButton ariaLabel="Add timezone" name="plus" onClick={addTimezone} />
          ) : (
            <IconButton ariaLabel="Remove timezone" name="times" onClick={() => removeTimezone(idx)} />
          )}
        </div>
      ))}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    width: 100%;
    display: flex;
    flex-direction: rows;
    align-items: center;
  `,
  first: css`
    margin-right: 8px;
    flex-grow: 2;
  `,
});
