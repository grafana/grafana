import { css, cx } from '@emotion/css';
import { type PropsWithChildren, type RefCallback, type JSX } from 'react';

import { type GrafanaTheme2, type SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useStyles2 } from '../../../themes/ThemeContext';
import { Icon } from '../../Icon/Icon';

import { TimeZoneDescription } from './TimeZoneDescription';
import { TimeZoneOffset } from './TimeZoneOffset';
import { TimeZoneTitle } from './TimeZoneTitle';
import { type TimeZoneDisplayInfo } from './timeZoneUtils';

interface Props {
  isFocused: boolean;
  isSelected: boolean;
  innerProps: JSX.IntrinsicElements['div'];
  innerRef: RefCallback<HTMLDivElement>;
  data: SelectableZone;
}

export interface SelectableZone extends SelectableValue<string> {
  searchIndex: string;
  info: TimeZoneDisplayInfo;
}

export const WideTimeZoneOption = (props: PropsWithChildren<Props>) => {
  const { children, innerProps, innerRef, data, isSelected, isFocused } = props;
  const styles = useStyles2(getStyles);
  const containerStyles = cx(styles.container, isFocused && styles.containerFocused);

  return (
    <div className={containerStyles} {...innerProps} ref={innerRef} data-testid={selectors.components.Select.option}>
      <div className={cx(styles.leftColumn, styles.row)}>
        <div className={cx(styles.leftColumn, styles.wideRow)}>
          <TimeZoneTitle title={children} />
          <div className={styles.spacer} />
          <TimeZoneDescription info={data.info} />
        </div>
        <div className={styles.rightColumn}>
          <TimeZoneOffset offset={`UTC${data.info.offset}`} />
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

export const CompactTimeZoneOption = (props: PropsWithChildren<Props>) => {
  const { children, innerProps, innerRef, data, isSelected, isFocused } = props;
  const styles = useStyles2(getStyles);
  const containerStyles = cx(styles.container, isFocused && styles.containerFocused);

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
            <TimeZoneDescription info={data.info} />
          </div>
          <div className={styles.rightColumn}>
            <TimeZoneOffset offset={`UTC${data.info.offset}`} />
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
    padding: theme.spacing(0.75, 1, 0.5),
    borderRadius: theme.shape.radius.default,

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
