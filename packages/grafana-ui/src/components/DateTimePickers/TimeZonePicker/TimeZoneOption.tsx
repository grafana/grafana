import { css, cx } from '@emotion/css';
import { isString } from 'lodash';
import React, { PropsWithChildren, RefCallback } from 'react';

import { GrafanaTheme2, SelectableValue, getTimeZoneInfo } from '@grafana/data';

import { useTheme2 } from '../../../themes/ThemeContext';
import { stylesFactory } from '../../../themes/stylesFactory';
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
  const theme = useTheme2();
  const styles = getStyles(theme);
  const timestamp = Date.now();
  const containerStyles = cx(styles.container, isFocused && styles.containerFocused);

  if (!isString(data.value)) {
    return null;
  }

  const timeZoneInfo = getTimeZoneInfo(data.value, timestamp);

  return (
    <div className={containerStyles} {...innerProps} ref={innerRef} aria-label="Select option">
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
  const theme = useTheme2();
  const styles = getStyles(theme);
  const timestamp = Date.now();
  const containerStyles = cx(styles.container, isFocused && styles.containerFocused);

  if (!isString(data.value)) {
    return null;
  }

  const timeZoneInfo = getTimeZoneInfo(data.value, timestamp);

  return (
    <div className={containerStyles} {...innerProps} ref={innerRef} aria-label="Select option">
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

const getStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    container: css`
      display: flex;
      align-items: center;
      flex-direction: row;
      flex-shrink: 0;
      white-space: nowrap;
      cursor: pointer;
      padding: 6px 8px 4px;

      &:hover {
        background: ${theme.colors.action.hover};
      }
    `,
    containerFocused: css`
      background: ${theme.colors.action.hover};
    `,
    body: css`
      display: flex;
      font-weight: ${theme.typography.fontWeightMedium};
      flex-direction: column;
      flex-grow: 1;
    `,
    row: css`
      display: flex;
      flex-direction: row;
    `,
    leftColumn: css`
      flex-grow: 1;
      text-overflow: ellipsis;
    `,
    rightColumn: css`
      justify-content: flex-end;
      align-items: center;
    `,
    wideRow: css`
      display: flex;
      flex-direction: row;
      align-items: baseline;
    `,
    spacer: css`
      margin-left: 6px;
    `,
  };
});
