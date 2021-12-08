import React, { useCallback, useRef, useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Icon, Portal, TagList, useTheme2 } from '@grafana/ui';
import { DashboardSectionItem, OnToggleChecked } from '../types';
import { SearchCheckbox } from './SearchCheckbox';
import { usePopper } from 'react-popper';
import { SearchCardFull } from './SearchCardFull';

export interface Props {
  editable?: boolean;
  item: DashboardSectionItem;
  onTagSelected?: (name: string) => any;
  onToggleChecked?: OnToggleChecked;
}

export function SearchCard({ editable, item, onTagSelected, onToggleChecked }: Props) {
  const theme = useTheme2();
  const [hasPreview, setHasPreview] = useState(true);
  const themeId = theme.isDark ? 'dark' : 'light';
  const imageSrc = `/preview/dash/${item.uid}/thumb/${themeId}`;
  const styles = getStyles(theme);
  const offset = useCallback(({ placement, reference, popper }) => {
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
          offset: offset,
        },
      },
    ],
  });
  const [isOpen, setIsOpen] = useState(false);
  const timeout = useRef<number | null>(null);

  const retryImage = () => {
    setHasPreview(false);
    const img = new Image();
    img.onload = () => setHasPreview(true);
    img.onerror = retryImage;
    setTimeout(() => {
      img.src = imageSrc;
    }, 5000);
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
      className={styles.gridItem}
      key={item.uid}
      href={item.url}
      ref={(ref) => setMarkerElement((ref as unknown) as HTMLDivElement)}
      onMouseEnter={() => {
        timeout.current = window.setTimeout(() => setIsOpen(true), 500);
      }}
      onMouseLeave={() => {
        if (timeout.current) {
          window.clearTimeout(timeout.current);
        }
        setIsOpen(false);
      }}
      onMouseMove={() => {
        if (timeout.current) {
          window.clearTimeout(timeout.current);
        }
        timeout.current = window.setTimeout(() => setIsOpen(true), 500);
      }}
    >
      <div className={styles.imageContainer}>
        <SearchCheckbox
          className={styles.checkbox}
          aria-label="Select dashboard"
          editable={editable}
          checked={item.checked}
          onClick={onCheckboxClick}
        />
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
        <div className={styles.overlay} />
      </div>
      <div className={styles.info}>
        <div className={styles.titleContainer}>{item.title}</div>
        <TagList isCompact tags={item.tags} onClick={onTagClick} />
      </div>
      {isOpen && (
        <Portal>
          <div ref={setPopperElement} style={popperStyles.popper} {...attributes.popper}>
            <SearchCardFull
              className={styles.fullCard}
              editable={editable}
              item={item}
              onTagSelected={onTagSelected}
              onToggleChecked={onToggleChecked}
            />
          </div>
        </Portal>
      )}
    </a>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  checkbox: css`
    left: 0;
    margin: ${theme.spacing(1)};
    position: absolute;
    top: 0;
  `,
  fullCard: css`
    @keyframes expand {
      0% {
        opacity: 0;
        transform: scale(0.5);
      }
      100% {
        opacity: 1;
        transform: scale(1);
      }
    }

    animation: expand ${theme.transitions.duration.shortest}ms ease-in-out 0s 1 normal forwards;
  `,
  gridItem: css`
    border: 1px solid ${theme.colors.border.medium};
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    width: 100%;
  `,
  image: css`
    box-shadow: ${theme.shadows.z2};
    margin: ${theme.spacing(1)} ${theme.spacing(4)} 0;
    width: calc(100% - 64px);
  `,
  imageContainer: css`
    background-color: ${theme.colors.background.secondary};
    flex: 1;
    overflow: hidden;
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
  info: css`
    align-items: center;
    background-color: ${theme.colors.background.canvas};
    display: flex;
    height: ${theme.spacing(7)};
    gap: ${theme.spacing(1)};
    padding: 0 ${theme.spacing(2)};
  `,
  overlay: css`
    bottom: 0;
    left: 0;
    position: absolute;
    right: 0;
    top: 0;
  `,
  placeholder: css`
    align-items: center;
    color: ${theme.colors.text.secondary};
    display: flex;
    height: 100%;
    justify-content: center;
    width: 100%;
  `,
  titleContainer: css`
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
});
