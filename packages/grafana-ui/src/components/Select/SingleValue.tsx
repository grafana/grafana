import { css, cx } from '@emotion/css';
import React from 'react';
import { components, GroupBase, SingleValueProps } from 'react-select';

import { GrafanaTheme2, SelectableValue, toIconName } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { useDelayedSwitch } from '../../utils/useDelayedSwitch';
import { Icon } from '../Icon/Icon';
import { Spinner } from '../Spinner/Spinner';
import { FadeTransition } from '../transitions/FadeTransition';
import { SlideOutTransition } from '../transitions/SlideOutTransition';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    singleValue: css`
      label: singleValue;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      box-sizing: border-box;
      max-width: 100%;
      grid-area: 1 / 1 / 2 / 3;
    `,
    spinnerWrapper: css`
      width: 16px;
      height: 16px;
      display: inline-block;
      margin-right: 10px;
      position: relative;
      vertical-align: middle;
      overflow: hidden;
    `,
    spinnerIcon: css`
      width: 100%;
      height: 100%;
      position: absolute;
    `,
    optionIcon: css`
      margin-right: ${theme.spacing(1)};
      color: ${theme.colors.text.secondary};
    `,
    disabled: css`
      color: ${theme.colors.text.disabled};
    `,
    isOpen: css`
      color: ${theme.colors.text.disabled};
    `,
  };
};

type StylesType = ReturnType<typeof getStyles>;

export type Props<T> = SingleValueProps<SelectableValue<T>, boolean, GroupBase<SelectableValue<T>>>;

export const SingleValue = <T extends unknown>(props: Props<T>) => {
  const { children, data, isDisabled } = props;
  const styles = useStyles2(getStyles);
  const loading = useDelayedSwitch(data.loading || false, { delay: 250, duration: 750 });
  const icon = data.icon ? toIconName(data.icon) : undefined;

  return (
    <components.SingleValue
      {...props}
      className={cx(styles.singleValue, isDisabled && styles.disabled, props.selectProps.menuIsOpen && styles.isOpen)}
    >
      {data.imgUrl ? (
        <FadeWithImage
          loading={loading}
          imgUrl={data.imgUrl}
          styles={styles}
          alt={(data.label ?? data.value) as string}
        />
      ) : (
        <>
          <SlideOutTransition horizontal size={16} visible={loading} duration={150}>
            <div className={styles.spinnerWrapper}>
              <Spinner className={styles.spinnerIcon} inline />
            </div>
          </SlideOutTransition>
          {icon && <Icon name={icon} role="img" className={styles.optionIcon} />}
        </>
      )}

      {!data.hideText && children}
    </components.SingleValue>
  );
};

const FadeWithImage = (props: { loading: boolean; imgUrl: string; styles: StylesType; alt?: string }) => {
  return (
    <div className={props.styles.spinnerWrapper}>
      <FadeTransition duration={150} visible={props.loading}>
        <Spinner className={props.styles.spinnerIcon} inline />
      </FadeTransition>
      <FadeTransition duration={150} visible={!props.loading}>
        <img className={props.styles.spinnerIcon} src={props.imgUrl} alt={props.alt} />
      </FadeTransition>
    </div>
  );
};
