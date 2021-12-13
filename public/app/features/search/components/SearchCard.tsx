import React, { useCallback, useRef, useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Icon, Portal, TagList, useTheme2 } from '@grafana/ui';
import { DashboardSectionItem, OnToggleChecked } from '../types';
import { SearchCheckbox } from './SearchCheckbox';
import { usePopper } from 'react-popper';
import { SearchCardFull } from './SearchCardFull';
import { backendSrv } from 'app/core/services/backend_srv';

export interface Props {
  editable?: boolean;
  item: DashboardSectionItem;
  onTagSelected?: (name: string) => any;
  onToggleChecked?: OnToggleChecked;
}

export function SearchCard({ editable, item, onTagSelected, onToggleChecked }: Props) {
  const NUM_IMAGE_RETRIES = 5;
  const IMAGE_RETRY_DELAY = 10000;

  const [hasImage, setHasImage] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>();
  const [showExpandedView, setShowExpandedView] = useState(false);
  const timeout = useRef<number | null>(null);

  // Popper specific logic
  const offsetCallback = useCallback(({ placement, reference, popper }) => {
    let result: [number, number] = [0, 0];
    if (placement === 'bottom' || placement === 'top') {
      result = [0, -(reference.height + popper.height) / 2];
    } else if (placement === 'left' || placement === 'right') {
      result = [-(reference.width + popper.width) / 2, 0];
    }
    return result;
  }, []);
  const [markerElement, setMarkerElement] = React.useState<HTMLDivElement | null>(null);
  const [popperElement, setPopperElement] = React.useState<HTMLDivElement | null>(null);
  const { styles: popperStyles, attributes } = usePopper(markerElement, popperElement, {
    modifiers: [
      {
        name: 'offset',
        options: {
          offset: offsetCallback,
        },
      },
    ],
  });

  const theme = useTheme2();
  const themeId = theme.isDark ? 'dark' : 'light';
  const imageSrc = `/preview/dash/${item.uid}/thumb/${themeId}`;
  const styles = getStyles(
    theme,
    markerElement?.getBoundingClientRect().width,
    popperElement?.getBoundingClientRect().width
  );

  const onShowExpandedView = async () => {
    setShowExpandedView(true);
    if (item.uid && !lastUpdated) {
      const dashboard = await backendSrv.getDashboardByUid(item.uid);
      const { updated } = dashboard.meta;
      setLastUpdated(new Date(updated).toLocaleString());
    }
  };

  const onMouseEnter = () => {
    timeout.current = window.setTimeout(onShowExpandedView, 500);
  };

  const onMouseMove = () => {
    if (timeout.current) {
      window.clearTimeout(timeout.current);
    }
    timeout.current = window.setTimeout(onShowExpandedView, 500);
  };

  const onMouseLeave = () => {
    if (timeout.current) {
      window.clearTimeout(timeout.current);
    }
    setShowExpandedView(false);
  };

  const retryImage = (retries: number) => {
    return () => {
      if (retries > 0) {
        if (hasImage) {
          setHasImage(false);
        }
        window.setTimeout(() => {
          const img = new Image();
          img.onload = () => setHasImage(true);
          img.onerror = retryImage(retries - 1);
          img.src = imageSrc;
        }, IMAGE_RETRY_DELAY);
      }
    };
  };

  const onCheckboxClick = (ev: React.MouseEvent) => {
    ev.stopPropagation();
    ev.preventDefault();

    onToggleChecked?.(item);
  };

  const onTagClick = (tag: string, ev: React.MouseEvent) => {
    ev.stopPropagation();
    ev.preventDefault();

    onTagSelected?.(tag);
  };

  return (
    <a
      className={styles.card}
      key={item.uid}
      href={item.url}
      ref={(ref) => setMarkerElement((ref as unknown) as HTMLDivElement)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseMove={onMouseMove}
    >
      <div className={styles.imageContainer}>
        <SearchCheckbox
          className={styles.checkbox}
          aria-label="Select dashboard"
          editable={editable}
          checked={item.checked}
          onClick={onCheckboxClick}
        />
        {hasImage ? (
          <img
            loading="lazy"
            className={styles.image}
            src={imageSrc}
            onLoad={() => setHasImage(true)}
            onError={retryImage(NUM_IMAGE_RETRIES)}
          />
        ) : (
          <div className={styles.imagePlaceholder}>
            <Icon name="apps" size="xl" />
          </div>
        )}
      </div>
      <div className={styles.info}>
        <div className={styles.title}>{item.title}</div>
        <TagList displayMax={1} tags={item.tags} onClick={onTagClick} />
      </div>
      {showExpandedView && (
        <Portal className={styles.portal}>
          <div ref={setPopperElement} style={popperStyles.popper} {...attributes.popper}>
            <SearchCardFull className={styles.expandedView} item={item} lastUpdated={lastUpdated} />
          </div>
        </Portal>
      )}
    </a>
  );
}

const getStyles = (theme: GrafanaTheme2, markerWidth = 0, popperWidth = 0) => ({
  card: css`
    background-color: ${theme.colors.background.secondary};
    border: 1px solid ${theme.colors.border.medium};
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
  `,
  checkbox: css`
    left: 0;
    margin: ${theme.spacing(1)};
    position: absolute;
    top: 0;
  `,
  expandedView: css`
    @keyframes expand {
      0% {
        transform: scale(${markerWidth / popperWidth});
      }
      100% {
        transform: scale(1);
      }
    }

    animation: expand ${theme.transitions.duration.shortest}ms ease-in-out 0s 1 normal;
  `,
  image: css`
    aspect-ratio: 4 / 3;
    box-shadow: ${theme.shadows.z2};
    margin: ${theme.spacing(1)} ${theme.spacing(4)} 0;
    width: calc(100% - 64px);
  `,
  imageContainer: css`
    flex: 1;
    position: relative;

    &:after {
      background: linear-gradient(180deg, rgba(196, 196, 196, 0) 0%, rgba(127, 127, 127, 0.25) 100%);
      bottom: 0;
      content: '';
      left: 0;
      margin: ${theme.spacing(1)} ${theme.spacing(4)} 0;
      position: absolute;
      right: 0;
      top: 0;
    }
  `,
  imagePlaceholder: css`
    align-items: center;
    aspect-ratio: 4 / 3;
    color: ${theme.colors.text.secondary};
    display: flex;
    justify-content: center;
    margin: ${theme.spacing(1)} ${theme.spacing(4)} 0;
    width: calc(100% - 64px);
  `,
  info: css`
    align-items: center;
    background-color: ${theme.colors.background.canvas};
    border-bottom-left-radius: 4px;
    border-bottom-right-radius: 4px;
    display: flex;
    height: ${theme.spacing(7)};
    gap: ${theme.spacing(1)};
    padding: 0 ${theme.spacing(2)};
  `,
  portal: css`
    pointer-events: none;
  `,
  title: css`
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
});
