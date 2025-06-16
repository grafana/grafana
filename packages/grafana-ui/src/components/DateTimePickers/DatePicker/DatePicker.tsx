import { css } from '@emotion/css';
import { memo } from 'react';
import Calendar from 'react-calendar';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../../themes/ThemeContext';
import { ClickOutsideWrapper } from '../../ClickOutsideWrapper/ClickOutsideWrapper';
import { Icon } from '../../Icon/Icon';
import { getBodyStyles } from '../TimeRangePicker/CalendarBody';

/** @public */
export interface DatePickerProps {
  isOpen?: boolean;
  onClose: () => void;
  onChange: (value: Date) => void;
  value?: Date;
  minDate?: Date;
  maxDate?: Date;
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

const Body = memo<DatePickerProps>(({ value, minDate, maxDate, onChange }) => {
  const styles = useStyles2(getBodyStyles);

  return (
    <Calendar
      className={styles.body}
      tileClassName={styles.title}
      value={value || new Date()}
      minDate={minDate}
      maxDate={maxDate}
      nextLabel={<Icon name="angle-right" />}
      prevLabel={<Icon name="angle-left" />}
      onChange={(ev) => {
        if (ev && !Array.isArray(ev)) {
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
    modal: css({
      zIndex: theme.zIndex.modal,
      boxShadow: theme.shadows.z3,
      backgroundColor: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderTopLeftRadius: theme.shape.radius.default,
      borderBottomLeftRadius: theme.shape.radius.default,

      'button:disabled': {
        color: theme.colors.text.disabled,
      },
    }),
  };
};
