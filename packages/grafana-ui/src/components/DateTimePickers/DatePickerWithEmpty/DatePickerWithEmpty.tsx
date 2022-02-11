import React, { ChangeEvent, memo } from 'react';
import Calendar from 'react-calendar';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '../../../themes';
import { ClickOutsideWrapper } from '../../ClickOutsideWrapper/ClickOutsideWrapper';
import { Icon } from '../../Icon/Icon';
// import { getBodyStyles } from '../TimeRangePicker/TimePickerCalendar';
import { getBodyStyles } from '../TimeRangePicker/CalendarBody';

import { InlineField } from '../../Forms/InlineField';
import { InlineSwitch } from '../../Switch/Switch';

/** @public */
export interface DatePickerWithEmptyProps {
  isOpen?: boolean;
  onClose: () => void;
  onChange: (value: Date, isDateInput: boolean) => void;
  isDateInput: boolean;
  value?: Date;
  returnValue?: 'start' | 'end';
}

/** @public */
export const DatePickerWithEmpty = memo<DatePickerWithEmptyProps>((props) => {
  const styles = useStyles2(getStyles);
  const { isOpen, onClose } = props;

  if (!isOpen) {
    return null;
  }

  return (
    <ClickOutsideWrapper useCapture={true} includeButtonPress={false} onClick={onClose}>
      <div className={styles.modal} data-testid="date-picker">
        <Body {...props} />
      </div>
    </ClickOutsideWrapper>
  );
});

DatePickerWithEmpty.displayName = 'DatePickerWithEmpty';

const Body = memo<DatePickerWithEmptyProps>(({ value, onChange, isDateInput, returnValue }) => {
  const styles = useStyles2(getBodyStyles);

  return (
    <div>
      <InlineField label={'Date Input'} labelWidth={20}>
        <InlineSwitch
          label={'Date Input'}
          value={isDateInput}
          onChange={(ev: ChangeEvent<HTMLInputElement>) => {
            onChange(value || new Date(), ev.target.checked);
          }}
        />
      </InlineField>
      <Calendar
        returnValue={returnValue || 'start'}
        className={styles.body}
        tileClassName={styles.title}
        value={value || new Date()}
        nextLabel={<Icon name="angle-right" />}
        prevLabel={<Icon name="angle-left" />}
        onChange={(date: Date | Date[]) => {
          if (!Array.isArray(date)) {
            onChange(date, true);
          }
        }}
        locale="en"
      />
    </div>
  );
});

Body.displayName = 'Body';

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    modal: css`
      z-index: ${theme.zIndex.modal};
      position: absolute;
      box-shadow: ${theme.shadows.z3};
      background-color: ${theme.colors.background.primary};
      border: 1px solid ${theme.colors.border.weak};
      border-radius: 2px 0 0 2px;
    `,
  };
};
