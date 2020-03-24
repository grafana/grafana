import React from 'react';
import { css, cx } from 'emotion';

// Ignoring because I couldn't get @types/react-select work wih Torkel's fork
// @ts-ignore
import { components } from '@torkelo/react-select';
import { useDelayedSwitch } from '../../../utils/useDelayedSwitch';
import { stylesFactory, useTheme } from '../../../themes';
import { SlideOutTransition } from '../../transitions/SlideOutTransition';
import { FadeTransition } from '../../transitions/FadeTransition';
import { Spinner } from '../../Spinner/Spinner';
import { GrafanaTheme } from '@grafana/data';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const singleValue = css`
    label: singleValue;
    color: ${theme.colors.formInputText};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    box-sizing: border-box;
    max-width: 100%;
    /* padding-right: 40px; */
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

  return { singleValue, container, item };
});

type Props = {
  children: React.ReactNode;
  data: {
    imgUrl?: string;
    loading?: boolean;
    hideText?: boolean;
  };
};

export const SingleValue = (props: Props) => {
  const { children, data } = props;
  const theme = useTheme();
  const styles = getStyles(theme);

  const loading = useDelayedSwitch(data.loading || false, { delay: 250, duration: 750 });

  return (
    <components.SingleValue {...props}>
      <div
        className={cx(
          styles.singleValue,
          css`
            overflow: hidden;
          `
        )}
      >
        {data.imgUrl ? (
          <FadeWithImage loading={loading} imgUrl={data.imgUrl} />
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

const FadeWithImage = (props: { loading: boolean; imgUrl: string }) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <div className={styles.container}>
      <FadeTransition duration={150} visible={props.loading}>
        <Spinner className={styles.item} inline />
      </FadeTransition>
      <FadeTransition duration={150} visible={!props.loading}>
        <img className={styles.item} src={props.imgUrl} />
      </FadeTransition>
    </div>
  );
};
