import React from 'react';
import { css, cx } from 'emotion';

// Ignoring because I couldn't get @types/react-select work wih Torkel's fork
// @ts-ignore
import { components } from '@torkelo/react-select';
import { useDelayedSwitch } from '../../utils/useDelayedSwitch';
import { stylesFactory } from '../../themes';
import { SlideOutTransition } from '../transitions/SlideOutTransition';
import { FadeTransition } from '../transitions/FadeTransition';
import { Spinner } from '../Spinner/Spinner';

const getStyles = stylesFactory(() => {
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

  return { container, item };
});

type Props = {
  children: React.ReactNode;
  data: {
    imgUrl?: string;
    loading?: boolean;
  };
};

export const SingleValue = (props: Props) => {
  const { children, data } = props;
  const styles = getStyles();

  const loading = useDelayedSwitch(data.loading || false, { delay: 250, duration: 750 });

  return (
    <components.SingleValue {...props}>
      <div className={cx('gf-form-select-box__img-value')}>
        {data.imgUrl ? (
          <FadeWithImage loading={loading} imgUrl={data.imgUrl} />
        ) : (
          <SlideOutTransition horizontal size={16} visible={loading} duration={150}>
            <div className={styles.container}>
              <Spinner className={styles.item} inline />
            </div>
          </SlideOutTransition>
        )}
        {children}
      </div>
    </components.SingleValue>
  );
};

const FadeWithImage = (props: { loading: boolean; imgUrl: string }) => {
  const styles = getStyles();

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
