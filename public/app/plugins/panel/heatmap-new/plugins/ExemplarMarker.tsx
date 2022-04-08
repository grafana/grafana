import React, { useCallback, useRef, useState } from 'react';
import { css, cx } from '@emotion/css';
import { DataFrame, GrafanaTheme, TimeZone } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Portal, UPlotConfigBuilder, useStyles } from '@grafana/ui';
import { ExemplarTooltip } from './ExemplarTooltip';
import { HeatmapLookup } from '../types';

interface ExemplarMarkerProps {
  timeZone: TimeZone;
  lookupRange: HeatmapLookup;
  config: UPlotConfigBuilder;
  getValuesInCell: (lookupRange: HeatmapLookup) => DataFrame[] | undefined;
}

export const ExemplarMarker: React.FC<ExemplarMarkerProps> = ({ lookupRange, getValuesInCell }) => {
  const styles = useStyles(getExemplarMarkerStyles);
  const [coords, setCoords] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const isToolTipOpen = useRef<boolean>(false);

  const [shouldDisplayCloseButton, setShouldDisplayCloseButton] = useState<boolean>(false);
  const popoverRenderTimeout = useRef<NodeJS.Timer>();

  const onCloseToolTip = () => {
    isToolTipOpen.current = false;
    setCoords({ x: null, y: null });
    setShouldDisplayCloseButton(false);
  };

  const onMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (popoverRenderTimeout.current) {
        clearTimeout(popoverRenderTimeout.current);
      }
      setCoords({ x: e.pageX, y: e.pageY });
    },
    [setCoords]
  );

  const onMouseLeave = useCallback(() => {
    popoverRenderTimeout.current = setTimeout(() => {
      if (!shouldDisplayCloseButton) {
        setCoords({ x: null, y: null });
      }
    }, 100);
  }, [shouldDisplayCloseButton, setCoords]);

  const onClick = useCallback(() => {
    isToolTipOpen.current = !isToolTipOpen.current;
    setShouldDisplayCloseButton(isToolTipOpen.current);
  }, [isToolTipOpen]);

  const renderMarker = useCallback(() => {
    const data: DataFrame[] | undefined = getValuesInCell(lookupRange);
    return (
      coords.x &&
      coords.y &&
      data && (
        <ExemplarTooltip
          ttip={{
            layers: [
              {
                name: 'Exemplar',
                data,
              },
            ],
            pageX: coords.x,
            pageY: coords.y,
            point: {},
          }}
          isOpen={isToolTipOpen.current}
          onClose={onCloseToolTip}
        />
      )
    );
  }, [getValuesInCell, lookupRange, coords]);

  return (
    <>
      <div
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
        className={styles.markerWrapper}
        aria-label={selectors.components.DataSource.Prometheus.exemplarMarker}
      >
        <svg
          viewBox="0 0 7 7"
          width="7"
          height="7"
          className={cx(styles.marble, coords.x !== null && styles.activeMarble)}
        >
          <rect key="diamond" x="3.38672" width="4.78985" height="4.78985" transform="rotate(45 3.38672 0)" />
        </svg>
      </div>
      {coords.x !== null && <Portal>{renderMarker()}</Portal>}
    </>
  );
};

const getExemplarMarkerStyles = (theme: GrafanaTheme) => {
  const bg = theme.isDark ? theme.palette.dark2 : theme.palette.white;
  const headerBg = theme.isDark ? theme.palette.dark9 : theme.palette.gray5;
  const shadowColor = theme.isDark ? theme.palette.black : theme.palette.white;
  const tableBgOdd = theme.isDark ? theme.palette.dark3 : theme.palette.gray6;

  return {
    markerWrapper: css`
      padding: 0 4px 4px 4px;
      width: 8px;
      height: 8px;
      box-sizing: content-box;
      transform: translate3d(-50%, 0, 0);
      &:hover {
        > svg {
          transform: scale(1.3);
          opacity: 1;
          filter: drop-shadow(0 0 8px rgba(0, 0, 0, 0.5));
        }
      }
    `,

    marker: css`
      width: 0;
      height: 0;
      border-left: 4px solid transparent;
      border-right: 4px solid transparent;
      border-bottom: 4px solid ${theme.palette.red};
      pointer-events: none;
    `,
    wrapper: css`
      background: ${bg};
      border: 1px solid ${headerBg};
      border-radius: ${theme.border.radius.md};
      box-shadow: 0 0 20px ${shadowColor};
    `,
    exemplarsTable: css`
      width: 100%;

      tr td {
        padding: 5px 10px;
        white-space: nowrap;
        border-bottom: 4px solid ${theme.colors.panelBg};
      }

      tr {
        background-color: ${theme.colors.bg1};
        &:nth-child(even) {
          background-color: ${tableBgOdd};
        }
      }
    `,
    valueWrapper: css`
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      column-gap: ${theme.spacing.sm};

      > span {
        flex-grow: 0;
      }

      > * {
        flex: 1 1;
        align-self: center;
      }
    `,
    tooltip: css`
      background: none;
      padding: 0;
    `,
    header: css`
      background: ${headerBg};
      padding: 6px 10px;
      display: flex;
    `,
    title: css`
      font-weight: ${theme.typography.weight.semibold};
      padding-right: ${theme.spacing.md};
      overflow: hidden;
      display: inline-block;
      white-space: nowrap;
      text-overflow: ellipsis;
      flex-grow: 1;
    `,
    body: css`
      padding: ${theme.spacing.sm};
      font-weight: ${theme.typography.weight.semibold};
    `,
    marble: css`
      display: block;
      opacity: 0.5;
      transition: transform 0.15s ease-out;
      stroke: 'rgb(0, 0, 0)';
      fill: ${theme.palette.greenShade};
    `,
    activeMarble: css`
      transform: scale(1.3);
      opacity: 1;
      filter: drop-shadow(0 0 8px rgba(0, 0, 0, 0.5));
      stroke: 'rgb(0, 0, 0)';
      fill: ${theme.palette.greenBase};
    `,
    closeButtonSpacer: css`
      margin-bottom: 15px;
    `,
  };
};
