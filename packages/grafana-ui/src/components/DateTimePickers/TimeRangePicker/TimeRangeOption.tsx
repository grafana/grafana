import { css, cx } from '@emotion/css';
import { memo } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { GrafanaTheme2, TimeOption } from '@grafana/data';

import { formatDate } from '../../../../../../public/app/core/internationalization/dates';
import { config } from '../../../../../grafana-runtime'
import { useStyles2 } from '../../../themes/ThemeContext';
import { getFocusStyles } from '../../../themes/mixins';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      display: 'flex',
      alignItems: 'center',
      flexDirection: 'row-reverse',
      justifyContent: 'space-between',
      position: 'relative',
    }),
    radio: css({
      opacity: 0,
      width: '0 !important',
      '&:focus-visible + label': getFocusStyles(theme),
    }),
    label: css({
      cursor: 'pointer',
      flex: 1,
      padding: theme.spacing(1),
      borderRadius: theme.shape.radius.default,

      '&:hover': {
        background: theme.colors.action.hover,
        cursor: 'pointer',
      },
    }),
    labelSelected: css({
      background: theme.colors.action.selected,

      '&::before': {
        backgroundImage: theme.colors.gradients.brandVertical,
        borderRadius: theme.shape.radius.default,
        content: '" "',
        display: 'block',
        height: '100%',
        position: 'absolute',
        width: theme.spacing(0.5),
        left: 0,
        top: 0,
      },
    }),
  };
};

interface Props {
  value: TimeOption;
  selected?: boolean;
  onSelect: (option: TimeOption) => void;
  /**
   *  Input identifier. This should be the same for all options in a group.
   */
  name: string;
}

export const TimeRangeOption = memo<Props>(({ value, onSelect, selected = false, name }) => {
  const styles = useStyles2(getStyles);
  // In case there are more of the same timerange in the list
  const id = uuidv4();
  const isLocaleFormatEnable = config.featureToggles.localeFormatPreference;
  const localeOptions: Intl.DateTimeFormatOptions = { 
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  };
  let formattedRange = value.display;
    if(isLocaleFormatEnable) {
      // Split the date using regex to get the "to" word, even translated, to get the "from" and "to" values
      const regex = /([a-zA-Z]+)/g;
      const timeRangeSplit = value.display.split(regex);
      const from = timeRangeSplit[0];
      const to = timeRangeSplit[2];
      // If from and to are not empty, localise them using the formatDate function
      if (from && to) {
        const fromLocalised = formatDate(from, localeOptions);
        const toLocalised = formatDate(to, localeOptions);
        const separator = timeRangeSplit[1];
        formattedRange = `${fromLocalised} ${separator} ${toLocalised}`;
      }
    }  
  return (
    <li className={styles.container}>
      <input
        className={styles.radio}
        checked={selected}
        name={name}
        type="checkbox"
        data-role="item"
        tabIndex={-1}
        id={id}
        onChange={() => onSelect(value)}
      />
      <label className={cx(styles.label, selected && styles.labelSelected)} htmlFor={id}>
        {formattedRange}
      </label>
    </li>
  );
});

TimeRangeOption.displayName = 'TimeRangeOption';
