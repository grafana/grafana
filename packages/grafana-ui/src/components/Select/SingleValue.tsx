import React from 'react';
import { css, cx } from '@emotion/css';
import { components, GroupBase, SingleValueProps } from 'react-select';
import { useDelayedSwitch } from '../../utils/useDelayedSwitch';
import { useStyles2 } from '../../themes';
import { SlideOutTransition } from '../transitions/SlideOutTransition';
import { FadeTransition } from '../transitions/FadeTransition';
import { Spinner } from '../Spinner/Spinner';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import tinycolor from 'tinycolor2';

const getStyles = (theme: GrafanaTheme2) => {
  const singleValue = css`
    label: singleValue;
    color: ${theme.components.input.text};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    box-sizing: border-box;
    max-width: 100%;
  `;
  const container = css`
    width: 16px;
    height: 16px;
    display: inline-block;
    margin-right: 10px;
    position: relative;
    vertical-align: middle;
    overflow: hidden;
  `;

  const item = css`
    width: 100%;
    height: 100%;
    position: absolute;
  `;

  const disabled = css`
    color: ${tinycolor(theme.colors.text.disabled).setAlpha(0.64).toString()};
  `;

  return { singleValue, container, item, disabled };
};

type StylesType = ReturnType<typeof getStyles>;

export type Props<T> = SingleValueProps<SelectableValue<T>, boolean, GroupBase<SelectableValue<T>>>;

export const SingleValue = <T extends unknown>(props: Props<T>) => {
  const { children, data, isDisabled } = props;
  const styles = useStyles2(getStyles);
  const loading = useDelayedSwitch(data.loading || false, { delay: 250, duration: 750 });

  return (
    <components.SingleValue {...props}>
      <div className={cx(styles.singleValue, isDisabled && styles.disabled)}>
        {data.imgUrl ? (
          <FadeWithImage
            loading={loading}
            imgUrl={data.imgUrl}
            styles={styles}
            alt={(data.label || data.value) as string}
          />
        ) : (
          <SlideOutTransition horizontal size={16} visible={loading} duration={150}>
            <div className={styles.container}>
              <Spinner className={styles.item} inline />
            </div>
          </SlideOutTransition>
        )}
        {!data.hideText && children}
      </div>
    </components.SingleValue>
  );
};

const FadeWithImage = (props: { loading: boolean; imgUrl: string; styles: StylesType; alt?: string }) => {
  return (
    <div className={props.styles.container}>
      <FadeTransition duration={150} visible={props.loading}>
        <Spinner className={props.styles.item} inline />
      </FadeTransition>
      <FadeTransition duration={150} visible={!props.loading}>
        <img className={props.styles.item} src={props.imgUrl} alt={props.alt} />
      </FadeTransition>
    </div>
  );
};
