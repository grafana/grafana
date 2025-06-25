import { css } from '@emotion/css';
import { useRef, ReactNode } from 'react';

import { GrafanaTheme2, TimeOption } from '@grafana/data';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../../themes/ThemeContext';

import { TimePickerTitle } from './TimePickerTitle';
import { TimeRangeOption } from './TimeRangeOption';
import { useListFocus } from './hooks';

interface Props {
  title?: string;
  options: TimeOption[];
  value?: TimeOption;
  onChange: (option: TimeOption) => void;
  placeholderEmpty?: ReactNode;
}

export const TimeRangeList = (props: Props) => {
  const styles = useStyles2(getStyles);
  const { title, options, placeholderEmpty } = props;

  if (typeof placeholderEmpty !== 'undefined' && options.length <= 0) {
    return <>{placeholderEmpty}</>;
  }

  if (!title) {
    return <Options {...props} />;
  }

  return (
    <section aria-label={title}>
      <fieldset>
        <div className={styles.title}>
          <TimePickerTitle>{title}</TimePickerTitle>
        </div>
        <Options {...props} />
      </fieldset>
    </section>
  );
};

const Options = ({ options, value, onChange, title }: Props) => {
  const styles = useStyles2(getOptionsStyles);

  const localRef = useRef<HTMLUListElement>(null);
  const [handleKeys] = useListFocus({ localRef, options });

  return (
    <>
      <ul
        role="presentation"
        onKeyDown={handleKeys}
        ref={localRef}
        aria-roledescription={t('time-picker.time-range.aria-role', 'Time range selection')}
        className={styles.list}
      >
        {options.map((option, index) => (
          <TimeRangeOption
            key={keyForOption(option, index)}
            value={option}
            selected={isEqual(option, value)}
            onSelect={onChange}
            name={title ?? t('time-picker.time-range.default-title', 'Time ranges')}
          />
        ))}
      </ul>
    </>
  );
};

function keyForOption(option: TimeOption, index: number): string {
  return `${option.from}-${option.to}-${index}`;
}

function isEqual(x: TimeOption, y?: TimeOption): boolean {
  if (!y || !x) {
    return false;
  }
  return y.from === x.from && y.to === x.to;
}

const getStyles = () => ({
  title: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 16px 5px 9px',
  }),
});

const getOptionsStyles = (theme: GrafanaTheme2) => ({
  list: css({
    padding: theme.spacing(0.5),
  }),
});
