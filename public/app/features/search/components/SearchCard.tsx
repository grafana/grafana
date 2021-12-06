import React, { useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';
import { DashboardSectionItem } from '../types';

export interface Props {
  item: DashboardSectionItem;
  themeId: 'dark' | 'light';
}

export function SearchCard({ item, themeId }: Props) {
  const theme = useTheme2();
  const styles = getStyles(theme);
  const [imageLoaded, setImageLoaded] = useState(true);
  const imageSrc = `/preview/dash/${item.uid}/square/${themeId}`;

  const retryImage = () => {
    setImageLoaded(false);
    const img = new Image();
    img.onload = () => setImageLoaded(true);
    img.onerror = retryImage;
    setTimeout(() => {
      img.src = imageSrc;
    }, 5000);
  };

  return (
    <a className={styles.gridItem} key={item.uid} href={item.url}>
      {imageLoaded && (
        <img
          loading="lazy"
          className={styles.image}
          src={imageSrc}
          onLoad={() => setImageLoaded(true)}
          onError={retryImage}
        />
      )}
      {!imageLoaded && <div className={styles.placeholder}>No preview available</div>}
    </a>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  gridItem: css`
    border-radius: 4px;
    height: 200px;
    overflow: hidden;
    position: relative;
  `,
  image: css`
    width: 100%;
  `,
  placeholder: css`
    align-items: center;
    background: ${theme.colors.background.secondary};
    color: ${theme.colors.text.secondary};
    display: flex;
    height: 100%;
    justify-content: center;
    position: absolute;
    top: 0;
    width: 100%;
  `,
});
