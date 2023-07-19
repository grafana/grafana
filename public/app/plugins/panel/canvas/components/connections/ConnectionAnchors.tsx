import { css } from '@emotion/css';
import React, { useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { ConnectionCoordinates } from 'app/features/canvas';

type Props = {
  setRef: (anchorElement: HTMLDivElement) => void;
  handleMouseLeave: (
    event: React.MouseEvent<Element, MouseEvent> | React.FocusEvent<HTMLDivElement, Element>
  ) => boolean;
};

export const CONNECTION_ANCHOR_DIV_ID = 'connectionControl';
export const CONNECTION_ANCHOR_ALT = 'connection anchor';
export const CONNECTION_ANCHOR_HIGHLIGHT_OFFSET = 8;

const ANCHOR_PADDING = 3;

export const ConnectionAnchors = ({ setRef, handleMouseLeave }: Props) => {
  const highlightEllipseRef = useRef<HTMLDivElement>(null);
  const styles = useStyles2(getStyles);
  const halfSize = 2.5;
  const halfSizeHighlightEllipse = 5.5;
  const anchorImage =
    'data:image/svg+xml;base64,PCFET0NUWVBFIHN2ZyBQVUJMSUMgIi0vL1czQy8vRFREIFNWRyAxLjEvL0VOIiAiaHR0cDovL3d3dy53My5vcmcvR3JhcGhpY3MvU1ZHLzEuMS9EVEQvc3ZnMTEuZHRkIj48c3ZnIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHdpZHRoPSI1cHgiIGhlaWdodD0iNXB4IiB2ZXJzaW9uPSIxLjEiPjxwYXRoIGQ9Im0gMCAwIEwgNSA1IE0gMCA1IEwgNSAwIiBzdHJva2Utd2lkdGg9IjIiIHN0eWxlPSJzdHJva2Utb3BhY2l0eTowLjQiIHN0cm9rZT0iI2ZmZmZmZiIvPjxwYXRoIGQ9Im0gMCAwIEwgNSA1IE0gMCA1IEwgNSAwIiBzdHJva2U9IiMyOWI2ZjIiLz48L3N2Zz4=';

  const onMouseEnterAnchor = (event: React.MouseEvent) => {
    if (!(event.target instanceof HTMLImageElement)) {
      return;
    }

    if (highlightEllipseRef.current && event.target.style) {
      highlightEllipseRef.current.style.display = 'block';
      highlightEllipseRef.current.style.top = `calc(${event.target.style.top} - ${halfSizeHighlightEllipse}px + ${ANCHOR_PADDING}px)`;
      highlightEllipseRef.current.style.left = `calc(${event.target.style.left} - ${halfSizeHighlightEllipse}px + ${ANCHOR_PADDING}px)`;
    }
  };

  const onMouseLeaveHighlightElement = () => {
    if (highlightEllipseRef.current) {
      highlightEllipseRef.current.style.display = 'none';
    }
  };

  const handleMouseLeaveAnchors = (
    event: React.MouseEvent<Element, MouseEvent> | React.FocusEvent<HTMLDivElement, Element>
  ) => {
    const didHideAnchors = handleMouseLeave(event);

    if (didHideAnchors) {
      onMouseLeaveHighlightElement();
    }
  };

  // Unit is percentage from the middle of the element
  // 0, 0 middle; -1, -1 bottom left; 1, 1 top right
  const ANCHORS = [
    { x: -1, y: 1 },
    { x: -0.5, y: 1 },
    { x: 0, y: 1 },
    { x: 0.5, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: 0.5 },
    { x: 1, y: 0 },
    { x: 1, y: -0.5 },
    { x: 1, y: -1 },
    { x: 0.5, y: -1 },
    { x: 0, y: -1 },
    { x: -0.5, y: -1 },
    { x: -1, y: -1 },
    { x: -1, y: -0.5 },
    { x: -1, y: 0 },
    { x: -1, y: 0.5 },
  ];

  const generateAnchors = (anchors: ConnectionCoordinates[] = ANCHORS) => {
    return anchors.map((anchor) => {
      const id = `${anchor.x},${anchor.y}`;

      // Convert anchor coords to relative percentage
      const style = {
        top: `calc(${-anchor.y * 50 + 50}% - ${halfSize}px - ${ANCHOR_PADDING}px)`,
        left: `calc(${anchor.x * 50 + 50}% - ${halfSize}px - ${ANCHOR_PADDING}px)`,
      };

      return (
        <img
          id={id}
          key={id}
          alt={CONNECTION_ANCHOR_ALT}
          className={styles.anchor}
          style={style}
          src={anchorImage}
          onMouseEnter={onMouseEnterAnchor}
        />
      );
    });
  };

  return (
    <div className={styles.root} ref={setRef}>
      <div className={styles.mouseoutDiv} onMouseOut={handleMouseLeaveAnchors} onBlur={handleMouseLeaveAnchors} />
      <div
        id={CONNECTION_ANCHOR_DIV_ID}
        ref={highlightEllipseRef}
        className={styles.highlightElement}
        onMouseLeave={onMouseLeaveHighlightElement}
      />
      {generateAnchors()}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  root: css`
    position: absolute;
    display: none;
  `,
  mouseoutDiv: css`
    position: absolute;
    margin: -30px;
    width: calc(100% + 60px);
    height: calc(100% + 60px);
  `,
  anchor: css`
    padding: ${ANCHOR_PADDING}px;
    position: absolute;
    cursor: cursor;
    width: calc(5px + 2 * ${ANCHOR_PADDING}px);
    height: calc(5px + 2 * ${ANCHOR_PADDING}px);
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
    border-radius: ${theme.shape.radius.circle};
    display: none;
    z-index: 110;
  `,
});
