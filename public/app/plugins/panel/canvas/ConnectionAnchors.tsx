import { css } from '@emotion/css';
import React, { useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

type Props = {
  setRef: (anchorElement: HTMLDivElement) => void;
};

export const CONNECTION_ANCHOR_DIV_ID = 'connectionControl';

export const ConnectionAnchors = ({ setRef }: Props) => {
  const highlightEllipseRef = useRef<HTMLDivElement>(null);
  const styles = useStyles2(getStyles);
  const halfSize = 2.5;
  const halfSizeHighlightEllipse = 5.5;
  const anchorImage =
    'data:image/svg+xml;base64,PCFET0NUWVBFIHN2ZyBQVUJMSUMgIi0vL1czQy8vRFREIFNWRyAxLjEvL0VOIiAiaHR0cDovL3d3dy53My5vcmcvR3JhcGhpY3MvU1ZHLzEuMS9EVEQvc3ZnMTEuZHRkIj48c3ZnIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHdpZHRoPSI1cHgiIGhlaWdodD0iNXB4IiB2ZXJzaW9uPSIxLjEiPjxwYXRoIGQ9Im0gMCAwIEwgNSA1IE0gMCA1IEwgNSAwIiBzdHJva2Utd2lkdGg9IjIiIHN0eWxlPSJzdHJva2Utb3BhY2l0eTowLjQiIHN0cm9rZT0iI2ZmZmZmZiIvPjxwYXRoIGQ9Im0gMCAwIEwgNSA1IE0gMCA1IEwgNSAwIiBzdHJva2U9IiMyOWI2ZjIiLz48L3N2Zz4=';

  const onMouseEnterAnchor = (event: React.MouseEvent) => {
    const target = event.target as HTMLImageElement;
    if (highlightEllipseRef.current && target.style) {
      highlightEllipseRef.current.style.display = 'block';
      highlightEllipseRef.current.style.top = `calc(${target.style.top} - ${halfSizeHighlightEllipse}px)`;
      highlightEllipseRef.current.style.left = `calc(${target.style.left} - ${halfSizeHighlightEllipse}px)`;
    }
  };

  const onMouseEnterHighlightElement = () => {
    // TODO: Implement drawing a connection here (or in scene selecto implementation)
  };

  const onMouseLeaveHighlightElement = () => {
    if (highlightEllipseRef.current) {
      highlightEllipseRef.current.style.display = 'none';
    }
  };

  const connectionAnchorAlt = 'connection anchor';

  return (
    <div
      style={{
        position: 'absolute',
        display: 'none',
      }}
      ref={setRef}
    >
      <div
        id={CONNECTION_ANCHOR_DIV_ID}
        ref={highlightEllipseRef}
        className={styles.highlightElement}
        onMouseEnter={onMouseEnterHighlightElement}
        onMouseLeave={onMouseLeaveHighlightElement}
      />
      <img
        alt={connectionAnchorAlt}
        id="tl"
        className={styles.anchor}
        style={{
          top: `-${halfSize}px`,
          left: `-${halfSize}px`,
        }}
        src={anchorImage}
        onMouseEnter={onMouseEnterAnchor}
      />
      <img
        alt={connectionAnchorAlt}
        id="ttl"
        className={styles.anchor}
        style={{
          top: `-${halfSize}px`,
          left: `calc(25% - ${halfSize}px)`,
        }}
        src={anchorImage}
        onMouseEnter={onMouseEnterAnchor}
      />
      <img
        alt={connectionAnchorAlt}
        id="t"
        className={styles.anchor}
        style={{
          left: `calc(50% - ${halfSize}px)`,
          top: `-${halfSize}px`,
        }}
        src={anchorImage}
        onMouseEnter={onMouseEnterAnchor}
      />
      <img
        alt={connectionAnchorAlt}
        id="ttr"
        className={styles.anchor}
        style={{
          left: `calc(75% - ${halfSize}px)`,
          top: `-${halfSize}px`,
        }}
        src={anchorImage}
        onMouseEnter={onMouseEnterAnchor}
      />
      <img
        alt={connectionAnchorAlt}
        id="tr"
        className={styles.anchor}
        style={{
          left: `calc(100% - ${halfSize}px)`,
          top: `-${halfSize}px`,
        }}
        src={anchorImage}
        onMouseEnter={onMouseEnterAnchor}
      />
      <img
        alt={connectionAnchorAlt}
        id="rrt"
        className={styles.anchor}
        style={{
          top: `calc(75% - ${halfSize}px)`,
          left: `calc(100% - ${halfSize}px)`,
        }}
        src={anchorImage}
        onMouseEnter={onMouseEnterAnchor}
      />
      <img
        alt={connectionAnchorAlt}
        id="r"
        className={styles.anchor}
        style={{
          top: `calc(50% - ${halfSize}px)`,
          left: `calc(100% - ${halfSize}px)`,
        }}
        src={anchorImage}
        onMouseEnter={onMouseEnterAnchor}
      />
      <img
        alt={connectionAnchorAlt}
        id="rrb"
        className={styles.anchor}
        style={{
          top: `calc(25% - ${halfSize}px)`,
          left: `calc(100% - ${halfSize}px)`,
        }}
        src={anchorImage}
        onMouseEnter={onMouseEnterAnchor}
      />
      <img
        alt={connectionAnchorAlt}
        id="br"
        className={styles.anchor}
        style={{
          left: `calc(100% - ${halfSize}px)`,
          top: `calc(100% - ${halfSize}px)`,
        }}
        src={anchorImage}
        onMouseEnter={onMouseEnterAnchor}
      />
      <img
        alt={connectionAnchorAlt}
        id="bbr"
        className={styles.anchor}
        style={{
          left: `calc(75% - ${halfSize}px)`,
          top: `calc(100% - ${halfSize}px)`,
        }}
        src={anchorImage}
        onMouseEnter={onMouseEnterAnchor}
      />
      <img
        alt={connectionAnchorAlt}
        id="b"
        className={styles.anchor}
        style={{
          left: `calc(50% - ${halfSize}px)`,
          top: `calc(100% - ${halfSize}px)`,
        }}
        src={anchorImage}
        onMouseEnter={onMouseEnterAnchor}
      />
      <img
        alt={connectionAnchorAlt}
        id="bbl"
        className={styles.anchor}
        style={{
          left: `calc(25% - ${halfSize}px)`,
          top: `calc(100% - ${halfSize}px)`,
        }}
        src={anchorImage}
        onMouseEnter={onMouseEnterAnchor}
      />
      <img
        alt={connectionAnchorAlt}
        id="bl"
        className={styles.anchor}
        style={{
          left: `-${halfSize}px`,
          top: `calc(100% - ${halfSize}px)`,
        }}
        src={anchorImage}
        onMouseEnter={onMouseEnterAnchor}
      />
      <img
        alt={connectionAnchorAlt}
        id="llb"
        className={styles.anchor}
        style={{
          top: `calc(75% - ${halfSize}px)`,
          left: `-${halfSize}px`,
        }}
        src={anchorImage}
        onMouseEnter={onMouseEnterAnchor}
      />
      <img
        alt={connectionAnchorAlt}
        id="l"
        className={styles.anchor}
        style={{
          top: `calc(50% - ${halfSize}px)`,
          left: `-${halfSize}px`,
        }}
        src={anchorImage}
        onMouseEnter={onMouseEnterAnchor}
      />
      <img
        alt={connectionAnchorAlt}
        id="llt"
        className={styles.anchor}
        style={{
          top: `calc(25% - ${halfSize}px)`,
          left: `-${halfSize}px`,
        }}
        src={anchorImage}
        onMouseEnter={onMouseEnterAnchor}
      />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  anchor: css`
    position: absolute;
    cursor: cursor;
    width: 5px;
    height: 5px;
    z-index: 100;
    pointer-events: auto !important;
  `,
  highlightElement: css`
    background-color: #00ff00;
    opacity: 0.3;
    position: absolute;
    cursor: cursor;
    position: absolute;
    pointer-events: auto;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    display: none;
    z-index: 110;
  `,
});
