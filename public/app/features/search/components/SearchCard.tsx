import { css } from '@emotion/css';
import { Placement, Rect } from '@popperjs/core';
import React, { useCallback, useRef, useState } from 'react';
import SVG from 'react-inlinesvg';
import { usePopper } from 'react-popper';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Icon, Portal, TagList, useTheme2 } from '@grafana/ui';
import { backendSrv } from 'app/core/services/backend_srv';

import { DashboardViewItem, OnToggleChecked } from '../types';

import { SearchCardExpanded } from './SearchCardExpanded';
import { SearchCheckbox } from './SearchCheckbox';

const DELAY_BEFORE_EXPANDING = 500;

export interface Props {
  editable?: boolean;
  item: DashboardViewItem;
  isSelected?: boolean;
  onTagSelected?: (name: string) => any;
  onToggleChecked?: OnToggleChecked;
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}

export function getThumbnailURL(uid: string, isLight?: boolean) {
  return `/api/dashboards/uid/${uid}/img/thumb/${isLight ? 'light' : 'dark'}`;
}

export function SearchCard({ editable, item, isSelected, onTagSelected, onToggleChecked, onClick }: Props) {
  const [hasImage, setHasImage] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [showExpandedView, setShowExpandedView] = useState(false);
  const timeout = useRef<number | null>(null);

  // Popper specific logic
  const offsetCallback = useCallback(
    ({ placement, reference, popper }: { placement: Placement; reference: Rect; popper: Rect }) => {
      let result: [number, number] = [0, 0];
      if (placement === 'bottom' || placement === 'top') {
        result = [0, -(reference.height + popper.height) / 2];
      } else if (placement === 'left' || placement === 'right') {
        result = [-(reference.width + popper.width) / 2, 0];
      }
      return result;
    },
    []
  );
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
  const imageSrc = getThumbnailURL(item.uid!, theme.isLight);
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
      if (updated) {
        setLastUpdated(new Date(updated).toLocaleString());
      } else {
        setLastUpdated(null);
      }
    }
  };

  const onMouseEnter = () => {
    timeout.current = window.setTimeout(onShowExpandedView, DELAY_BEFORE_EXPANDING);
  };

  const onMouseMove = () => {
    if (timeout.current) {
      window.clearTimeout(timeout.current);
    }
    timeout.current = window.setTimeout(onShowExpandedView, DELAY_BEFORE_EXPANDING);
  };

  const onMouseLeave = () => {
    if (timeout.current) {
      window.clearTimeout(timeout.current);
    }
    setShowExpandedView(false);
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
      data-testid={selectors.components.Search.dashboardCard(item.title)}
      className={styles.card}
      key={item.uid}
      href={item.url}
      ref={(ref) => setMarkerElement(ref as unknown as HTMLDivElement)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseMove={onMouseMove}
      onClick={onClick}
    >
      <div className={styles.imageContainer}>
        <SearchCheckbox
          className={styles.checkbox}
          aria-label={`Select dashboard ${item.title}`}
          editable={editable}
          checked={isSelected}
          onClick={onCheckboxClick}
        />
        {hasImage ? (
          <img
            loading="lazy"
            className={styles.image}
            src={imageSrc}
            alt="Dashboard preview"
            onError={() => setHasImage(false)}
          />
        ) : (
          <div className={styles.imagePlaceholder}>
            {item.icon ? (
              <SVG src={item.icon} width={36} height={36} title={item.title} />
            ) : (
              <Icon name="apps" size="xl" />
            )}
          </div>
        )}
      </div>
      <div className={styles.info}>
        <div className={styles.title}>{item.title}</div>
        <TagList displayMax={1} tags={item.tags ?? []} onClick={onTagClick} />
      </div>
      {showExpandedView && (
        <Portal className={styles.portal}>
          <div ref={setPopperElement} style={popperStyles.popper} {...attributes.popper}>
            <SearchCardExpanded
              className={styles.expandedView}
              imageHeight={240}
              imageWidth={320}
              item={item}
              lastUpdated={lastUpdated}
              onClick={onClick}
            />
          </div>
        </Portal>
      )}
    </a>
  );
}

const getStyles = (theme: GrafanaTheme2, markerWidth = 0, popperWidth = 0) => {
  const IMAGE_HORIZONTAL_MARGIN = theme.spacing(4);

  return {
    card: css`
      background-color: ${theme.colors.background.secondary};
      border: 1px solid ${theme.colors.border.medium};
      border-radius: 4px;
      display: flex;
      flex-direction: column;

      &:hover {
        background-color: ${theme.colors.emphasize(theme.colors.background.secondary, 0.03)};
      }
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
      background-color: ${theme.colors.emphasize(theme.colors.background.secondary, 0.03)};
    `,
    image: css`
      aspect-ratio: 4 / 3;
      box-shadow: ${theme.shadows.z1};
      margin: ${theme.spacing(1)} ${IMAGE_HORIZONTAL_MARGIN} 0;
      width: calc(100% - (2 * ${IMAGE_HORIZONTAL_MARGIN}));
    `,
    imageContainer: css`
      flex: 1;
      position: relative;

      &:after {
        background: linear-gradient(180deg, rgba(196, 196, 196, 0) 0%, rgba(127, 127, 127, 0.25) 100%);
        bottom: 0;
        content: '';
        left: 0;
        margin: ${theme.spacing(1)} ${IMAGE_HORIZONTAL_MARGIN} 0;
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
      margin: ${theme.spacing(1)} ${IMAGE_HORIZONTAL_MARGIN} 0;
      width: calc(100% - (2 * ${IMAGE_HORIZONTAL_MARGIN}));
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
      z-index: 1;
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
  };
};
