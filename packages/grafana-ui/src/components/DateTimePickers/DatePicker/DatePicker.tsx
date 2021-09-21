import React, { memo } from 'react';
import Calendar from 'react-calendar/dist/entry.nostyle';
import { css } from 'emotion';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '../../../themes';
import { ClickOutsideWrapper } from '../../ClickOutsideWrapper/ClickOutsideWrapper';
import { Icon } from '../../Icon/Icon';
import { getBodyStyles } from '../TimeRangePicker/TimePickerCalendar';

/** @public */
export interface DatePickerProps {
  isOpen?: boolean;
  onClose: () => void;
  onChange: (value: Date) => void;
  value?: Date;
}

/** @public */
export const DatePicker = memo<DatePickerProps>((props) => {
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

DatePicker.displayName = 'DatePicker';

const Body = memo<DatePickerProps>(({ value, onChange }) => {
  const styles = useStyles2(getBodyStyles);

  return (
    <Calendar
      className={styles.body}
      tileClassName={styles.title}
      value={value || new Date()}
      nextLabel={<Icon name="angle-right" />}
      prevLabel={<Icon name="angle-left" />}
      onChange={(ev) => {
        if (!Array.isArray(ev)) {
          onChange(ev);
        }
      }}
      locale="en"
    />
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
