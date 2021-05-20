import React from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

interface Props {
  href: string;
  text: React.ReactNode;
  image: React.ReactNode;
  layout?: 'horizontal' | 'vertical';
}

export const Card = ({ href, text, image, layout = 'vertical' }: Props) => {
  const styles = useStyles2(getCardStyles);

  return (
    <a href={href} className={styles.root}>
      <div
        className={cx(styles.container, {
          [styles.containerHorizontal]: layout === 'horizontal',
        })}
      >
        <div
          className={cx(styles.imgContainer, {
            [styles.imgContainerHorizontal]: layout === 'horizontal',
          })}
        >
          {image}
        </div>
        {text}
      </div>
    </a>
  );
};

const getCardStyles = (theme: GrafanaTheme2) => ({
  root: css`
    background-color: ${theme.colors.background.secondary};
    border-radius: ${theme.shape.borderRadius()};
    cursor: pointer;
    height: 100%;
    padding: ${theme.spacing(2)};

    &:hover {
      background-color: ${theme.colors.action.hover};
    }
  `,
  container: css`
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    height: 100%;
  `,
  containerHorizontal: css`
    flex-direction: row;
    justify-content: flex-start;
  `,
  imgContainer: css`
    align-items: center;
    display: flex;
    flex-grow: 1;
    justify-content: center;
    padding: ${theme.spacing()} 0;
  `,
  imgContainerHorizontal: css`
    flex-grow: 0;
  `,
});
