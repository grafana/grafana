import React, { FC, FormEvent, useState } from 'react';
import { ClickOutsideWrapper } from '../ClickOutsideWrapper/ClickOutsideWrapper';
import { Icon } from '../Icon/Icon';
import { TimePickerButtonLabel } from './TimeRangePicker';
import { GrafanaTheme, TimeRange, TimeZone } from '@grafana/data';
import { useStyles } from '../../themes/ThemeContext';
import { TimePickerContent } from './TimeRangePicker/TimePickerContent';
import { otherOptions, quickOptions } from './rangeOptions';
import { Button } from '../Button';
import { css } from 'emotion';

export interface Props {
  hideText?: boolean;
  value: TimeRange;
  timeZone?: TimeZone;
  onChange: (timeRange: TimeRange) => void;
  onChangeTimeZone: (timeZone: TimeZone) => void;
}

export const TimeRangeInput: FC<Props> = ({ value, onChange, onChangeTimeZone, timeZone = 'browser' }) => {
  const [isOpen, setIsOpen] = useState(false);

  const onOpen = (event: FormEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.preventDefault();
    setIsOpen(!isOpen);
  };

  const onClose = () => {
    setIsOpen(false);
  };

  const styles = useStyles(getStyles);

  return (
    <div className={styles.container}>
      <Button variant="secondary" aria-label="TimePicker Open Button" onClick={onOpen}>
        <TimePickerButtonLabel value={value} />
        <span className={styles.caretIcon}>{<Icon name={isOpen ? 'angle-up' : 'angle-down'} size="lg" />}</span>
      </Button>
      {isOpen && (
        <ClickOutsideWrapper includeButtonPress={false} onClick={onClose}>
          <TimePickerContent
            timeZone={timeZone}
            value={value}
            onChange={onChange}
            otherOptions={otherOptions}
            quickOptions={quickOptions}
            onChangeTimeZone={onChangeTimeZone}
          />
        </ClickOutsideWrapper>
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    container: css`
      display: flex;
    `,
    caretIcon: css`
      margin-left: ${theme.spacing.xs};
    `,
  };
};
