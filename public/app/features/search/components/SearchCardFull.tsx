import React, { useState } from 'react';
import { css } from '@emotion/css';
import classNames from 'classnames';
import { GrafanaTheme2 } from '@grafana/data';
import { Icon, Spinner, TagList, useTheme2 } from '@grafana/ui';
import { DashboardSectionItem } from '../types';

export interface Props {
  className?: string;
  item: DashboardSectionItem;
  lastUpdated?: string;
}

export function SearchCardFull({ className, item, lastUpdated }: Props) {
  const theme = useTheme2();
  const [hasPreview, setHasPreview] = useState(true);
  const themeId = theme.isDark ? 'dark' : 'light';
  const imageSrc = `/preview/dash/${item.uid}/thumb/${themeId}`;
  const styles = getStyles(theme);

  const retryImage = () => {
    setHasPreview(false);
    const img = new Image();
    img.onload = () => setHasPreview(true);
    img.onerror = retryImage;
    setTimeout(() => {
      img.src = imageSrc;
    }, 5000);
  };

  const folderTitle = item.folderTitle || 'General';

  return (
    <a className={classNames(className, styles.gridItem)} key={item.uid} href={item.url}>
      <div className={styles.imageContainer}>
        {hasPreview && (
          <img
            loading="lazy"
            className={styles.image}
            src={imageSrc}
            onLoad={() => setHasPreview(true)}
            onError={retryImage}
          />
        )}
        {!hasPreview && (
          <div className={styles.placeholder}>
            <Icon name="apps" size="xl" />
          </div>
        )}
      </div>
      <div className={styles.info}>
        <div className={styles.header}>
          <div className={styles.titleContainer}>
            <div>{item.title}</div>
            <div className={styles.folder}>
              <Icon name={'folder'} />
              {folderTitle}
            </div>
          </div>
          <div className={styles.updateContainer}>
            <div>Last updated</div>
            {!lastUpdated && <Spinner />}
            {lastUpdated && <div className={styles.update}>{lastUpdated}</div>}
          </div>
        </div>
        <div>
          <TagList className={styles.tagList} tags={item.tags} />
        </div>
      </div>
    </a>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  folder: css`
    align-items: center;
    color: ${theme.colors.text.secondary};
    display: flex;
    font-size: ${theme.typography.size.sm};
    gap: ${theme.spacing(0.5)};
  `,
  gridItem: css`
    background-color: ${theme.colors.background.secondary};
    border: 1px solid ${theme.colors.border.medium};
    border-radius: 4px;
    box-shadow: ${theme.shadows.z3};
    display: flex;
    flex-direction: column;
    height: 100%;
    max-width: 384px;
    width: 100%;
  `,
  header: css`
    display: flex;
    gap: ${theme.spacing(1)};
    justify-content: space-between;
  `,
  image: css`
    box-shadow: ${theme.shadows.z3};
    height: 240px;
    margin: ${theme.spacing(1)} calc(${theme.spacing(4)} - 1px) 0;
    width: 320px;
  `,
  imageContainer: css`
    flex: 1;
    position: relative;

    &:after {
      background: linear-gradient(180deg, rgba(196, 196, 196, 0) 0%, rgba(127, 127, 127, 0.25) 100%);
      bottom: 0;
      content: '';
      left: 0;
      margin: ${theme.spacing(1)} calc(${theme.spacing(4)} - 1px) 0;
      position: absolute;
      right: 0;
      top: 0;
    }
  `,
  info: css`
    background-color: ${theme.colors.background.canvas};
    border-bottom-left-radius: 4px;
    border-bottom-right-radius: 4px;
    display: flex;
    flex-direction: column;
    min-height: ${theme.spacing(7)};
    gap: ${theme.spacing(1)};
    padding: ${theme.spacing(1)} ${theme.spacing(2)};
  `,
  placeholder: css`
    align-items: center;
    color: ${theme.colors.text.secondary};
    display: flex;
    height: 240px;
    justify-content: center;
    margin: ${theme.spacing(1)} ${theme.spacing(4)} 0;
    width: 320px;
  `,
  tagList: css`
    justify-content: flex-start;
  `,
  titleContainer: css`
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing(0.5)};
  `,
  updateContainer: css`
    align-items: flex-end;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    font-size: ${theme.typography.bodySmall.fontSize};
    gap: ${theme.spacing(0.5)};
  `,
  update: css`
    color: ${theme.colors.text.secondary};
    text-align: right;
  `,
});
