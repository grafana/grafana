import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useTheme2, stylesFactory } from '@grafana/ui';

interface Props {
  href: string;
  text: React.ReactNode;
  image: React.ReactNode;
  layout?: 'horizontal' | 'vertical';
}

export const Card = ({ href, text, image, layout = 'vertical' }: Props) => {
  const theme = useTheme2();
  const styles = getCardStyles(theme, layout);

  return (
    <a href={href} className={styles.root}>
      <div className={styles.container}>
        <div className={styles.imgContainer}>{image}</div>
        {text}
      </div>
    </a>
  );
};

const getCardStyles = stylesFactory((theme: GrafanaTheme2, layout) => ({
  root: css`
    background-color: ${theme.colors.background.primary};
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
    flex-direction: ${layout === 'vertical' ? 'column' : 'row'};
    justify-content: ${layout === 'vertical' ? 'space-around' : 'flex-start'};
    height: 100%;
  `,
  imgContainer: css`
    flex-grow: ${layout === 'vertical' ? 1 : 0};
    padding: ${theme.spacing()} 0;
    display: flex;
    justify-content: center;
    align-items: center;
  `,
}));
