import { css, cx } from '@emotion/css';
import { isString } from 'lodash';
import { PropsWithChildren, RefCallback } from 'react';
import * as React from 'react';

import { GrafanaTheme2, SelectableValue, getTimeZoneInfo } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useStyles2 } from '../../../themes/ThemeContext';
import { Icon } from '../../Icon/Icon';

import { TimeZoneDescription } from './TimeZoneDescription';
import { TimeZoneOffset } from './TimeZoneOffset';
import { TimeZoneTitle } from './TimeZoneTitle';

interface Props {
  isFocused: boolean;
  isSelected: boolean;
  innerProps: JSX.IntrinsicElements['div'];
  innerRef: RefCallback<HTMLDivElement>;
  data: SelectableZone;
}

const offsetClassName = 'tz-utc-offset';

export interface SelectableZone extends SelectableValue<string> {
  searchIndex: string;
}

export const WideTimeZoneOption = (props: PropsWithChildren<Props>) => {
  const { children, innerProps, innerRef, data, isSelected, isFocused } = props;
  const styles = useStyles2(getStyles);
  const timestamp = Date.now();
  const containerStyles = cx(styles.container, isFocused && styles.containerFocused);

  if (!isString(data.value)) {
    return null;
  }

  const timeZoneInfo = getTimeZoneInfo(data.value, timestamp);

  return (
    <div className={containerStyles} {...innerProps} ref={innerRef} data-testid={selectors.components.Select.option}>
      <div className={cx(styles.leftColumn, styles.row)}>
        <div className={cx(styles.leftColumn, styles.wideRow)}>
          <TimeZoneTitle title={children} />
          <div className={styles.spacer} />
          <TimeZoneDescription info={timeZoneInfo} />
        </div>
        <div className={styles.rightColumn}>
          <TimeZoneOffset
            /* Use the timeZoneInfo to pass the correct timeZone name,
               as 'Default' has value '' which defaults to browser timezone */
            timeZone={timeZoneInfo?.ianaName || data.value}
            timestamp={timestamp}
            className={offsetClassName}
          />
          {isSelected && (
            <span>
              <Icon name="check" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export const CompactTimeZoneOption = (props: React.PropsWithChildren<Props>) => {
  const { children, innerProps, innerRef, data, isSelected, isFocused } = props;
  const styles = useStyles2(getStyles);
  const timestamp = Date.now();
  const containerStyles = cx(styles.container, isFocused && styles.containerFocused);

  if (!isString(data.value)) {
    return null;
  }

  const timeZoneInfo = getTimeZoneInfo(data.value, timestamp);

  return (
    <div className={containerStyles} {...innerProps} ref={innerRef} data-testid={selectors.components.Select.option}>
      <div className={styles.body}>
        <div className={styles.row}>
          <div className={styles.leftColumn}>
            <TimeZoneTitle title={children} />
          </div>
          <div className={styles.rightColumn}>
            {isSelected && (
              <span>
                <Icon name="check" />
              </span>
            )}
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.leftColumn}>
            <TimeZoneDescription info={timeZoneInfo} />
          </div>
          <div className={styles.rightColumn}>
            <TimeZoneOffset
              timestamp={timestamp}
              /* Use the timeZoneInfo to pass the correct timeZone name,
                 as 'Default' has value '' which defaults to browser timezone */
              timeZone={timeZoneInfo?.ianaName || data.value}
              className={offsetClassName}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    padding: '6px 8px 4px',

    '&:hover': {
      background: theme.colors.action.hover,
    },
  }),
  containerFocused: css({
    background: theme.colors.action.hover,
  }),
  body: css({
    display: 'flex',
    fontWeight: theme.typography.fontWeightMedium,
    flexDirection: 'column',
    flexGrow: 1,
  }),
  row: css({
    display: 'flex',
    flexDirection: 'row',
  }),
  leftColumn: css({
    flexGrow: 1,
    textOverflow: 'ellipsis',
  }),
  rightColumn: css({
    justifyContent: 'flex-end',
    alignItems: 'center',
  }),
  wideRow: css({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'baseline',
  }),
  spacer: css({
    marginLeft: '6px',
  }),
});
