import React, { useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';
import { DashboardSectionItem, OnToggleChecked } from '../types';
import { SearchCheckbox } from './SearchCheckbox';

export interface Props {
  editable?: boolean;
  item: DashboardSectionItem;
  onTagSelected: (name: string) => any;
  onToggleChecked?: OnToggleChecked;
  themeId: 'dark' | 'light';
}

export function SearchCard({ editable, item, onTagSelected, onToggleChecked, themeId }: Props) {
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

  const handleCheckboxClick = (ev: React.MouseEvent) => {
    ev.stopPropagation();
    ev.preventDefault();

    if (onToggleChecked) {
      onToggleChecked(item);
    }
  };

  return (
    <a className={styles.gridItem} key={item.uid} href={item.url}>
      <div className={styles.imageContainer}>
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
      </div>
      <div className={styles.info}>
        <SearchCheckbox
          aria-label="Select dashboard"
          editable={editable}
          checked={item.checked}
          onClick={handleCheckboxClick}
        />
        {item.title}
      </div>
    </a>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  gridItem: css`
    border: 1px solid ${theme.colors.border.medium};
    border-radius: 4px;
    overflow: hidden;
  `,
  image: css`
    width: 100%;
  `,
  imageContainer: css`
    height: 200px;
    overflow: hidden;
    position: relative;
  `,
  info: css`
    align-items: center;
    background-color: ${theme.colors.background.secondary};
    display: flex;
    height: 60px;
    gap: ${theme.spacing(1)};
    padding: 0 ${theme.spacing(1)};
  `,
  placeholder: css`
    align-items: center;
    background: ${theme.colors.background.canvas};
    color: ${theme.colors.text.secondary};
    display: flex;
    height: 100%;
    justify-content: center;
    position: absolute;
    top: 0;
    width: 100%;
  `,
});
