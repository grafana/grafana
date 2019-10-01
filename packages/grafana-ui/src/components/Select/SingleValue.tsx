import React from 'react';
import { css, cx } from 'emotion';

// Ignoring because I couldn't get @types/react-select work wih Torkel's fork
// @ts-ignore
import { components } from '@torkelo/react-select';
import { FadeTransition, Spinner } from '..';
import { useDelayedSwitch } from '../../utils/useDelayedSwitch';
import { stylesFactory } from '../../themes';

const getStyles = stylesFactory(() => {
  const container = css`
    width: 16px;
    height: 16px;
    display: inline-block;
    margin-right: 10px;
    position: relative;
    vertical-align: middle;
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
        <div className={styles.container}>
          <FadeTransition duration={150} visible={loading}>
            <Spinner className={styles.item} inline />
          </FadeTransition>
          {data.imgUrl && (
            <FadeTransition duration={150} visible={!loading}>
              <img className={styles.item} src={data.imgUrl} />
            </FadeTransition>
          )}
        </div>
        {children}
      </div>
    </components.SingleValue>
  );
};
