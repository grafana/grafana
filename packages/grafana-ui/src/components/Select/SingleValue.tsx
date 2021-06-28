import React from 'react';
import { css, cx } from '@emotion/css';
import { components, SingleValueProps } from 'react-select';
import { useDelayedSwitch } from '../../utils/useDelayedSwitch';
import { useStyles2 } from '../../themes';
import { SlideOutTransition } from '../transitions/SlideOutTransition';
import { FadeTransition } from '../transitions/FadeTransition';
import { Spinner } from '../Spinner/Spinner';
import { GrafanaTheme2 } from '@grafana/data';

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
    color: ${theme.colors.action.disabledText};
  `;

  return { singleValue, container, item, disabled };
};

type StylesType = ReturnType<typeof getStyles>;

interface Props
  extends SingleValueProps<{
    imgUrl?: string;
    loading?: boolean;
    hideText?: boolean;
  }> {
  disabled?: boolean;
}

export const SingleValue = (props: Props) => {
  const { children, data, disabled } = props;
  const styles = useStyles2(getStyles);
  const loading = useDelayedSwitch(data.loading || false, { delay: 250, duration: 750 });

  return (
    <components.SingleValue {...props}>
      <div className={cx(styles.singleValue, disabled && styles.disabled)}>
        {data.imgUrl ? (
          <FadeWithImage loading={loading} imgUrl={data.imgUrl} styles={styles} />
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

const FadeWithImage = (props: { loading: boolean; imgUrl: string; styles: StylesType }) => {
  return (
    <div className={props.styles.container}>
      <FadeTransition duration={150} visible={props.loading}>
        <Spinner className={props.styles.item} inline />
      </FadeTransition>
      <FadeTransition duration={150} visible={!props.loading}>
        <img className={props.styles.item} src={props.imgUrl} />
      </FadeTransition>
    </div>
  );
};
