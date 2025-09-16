import { css, cx } from '@emotion/css';
import {
  autoUpdate,
  flip,
  safePolygon,
  shift,
  useDismiss,
  useFloating,
  useHover,
  useInteractions,
} from '@floating-ui/react';
import { useCallback, useEffect, useState } from 'react';
import * as React from 'react';

import { DataFrame, Field, formattedValueToString, GrafanaTheme2, LinkModel } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { TimeZone } from '@grafana/schema';
import { Portal, UPlotConfigBuilder, useStyles2 } from '@grafana/ui';
import { VizTooltipItem } from '@grafana/ui/internal';
import { CloseButton } from 'app/core/components/CloseButton/CloseButton';
import { ExemplarTooltip } from 'app/features/visualization/data-hover/ExemplarTooltip';

import { getDataLinks } from '../../status-history/utils';

interface ExemplarMarkerProps {
  timeZone: TimeZone;
  dataFrame: DataFrame;
  frameIndex: number;
  rowIndex: number;
  config: UPlotConfigBuilder;
  exemplarColor?: string;
  clickedRowIndex: number | undefined;
  setClickedRowIndex: React.Dispatch<number | undefined>;
  maxHeight?: number;
  maxWidth?: number;
}

export const ExemplarMarker = ({
  timeZone,
  dataFrame,
  frameIndex,
  rowIndex,
  config,
  exemplarColor,
  clickedRowIndex,
  setClickedRowIndex,
  maxHeight,
  maxWidth,
}: ExemplarMarkerProps) => {
  const styles = useStyles2(getExemplarMarkerStyles, maxWidth);
  const [isOpen, setIsOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  // the order of middleware is important!
  const middleware = [
    flip({
      fallbackAxisSideDirection: 'end',
      // see https://floating-ui.com/docs/flip#combining-with-shift
      crossAxis: false,
      boundary: document.body,
    }),
    shift(),
  ];

  const { context, refs, floatingStyles } = useFloating({
    open: isOpen,
    placement: 'bottom',
    onOpenChange: setIsOpen,
    middleware,
    whileElementsMounted: autoUpdate,
    strategy: 'fixed',
  });

  const dismiss = useDismiss(context);
  const hover = useHover(context, {
    handleClose: safePolygon(),
    enabled: clickedRowIndex === undefined,
  });

  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss, hover]);

  useEffect(() => {
    if (clickedRowIndex !== rowIndex) {
      setIsLocked(false);
    }
  }, [clickedRowIndex, rowIndex]);

  const getSymbol = () => {
    return (
      <rect
        fill={exemplarColor}
        key="diamond"
        x="3.38672"
        width="4.78985"
        height="4.78985"
        transform="rotate(45 3.38672 0)"
      />
    );

    // const symbols = [
    //   <rect
    //     fill={exemplarColor}
    //     key="diamond"
    //     x="3.38672"
    //     width="4.78985"
    //     height="4.78985"
    //     transform="rotate(45 3.38672 0)"
    //   />,
    //   <path
    //     fill={exemplarColor}
    //     key="x"
    //     d="M1.94444 3.49988L0 5.44432L1.55552 6.99984L3.49996 5.05539L5.4444 6.99983L6.99992 5.44431L5.05548 3.49988L6.99983 1.55552L5.44431 0L3.49996 1.94436L1.5556 0L8.42584e-05 1.55552L1.94444 3.49988Z"
    //   />,
    //   <path fill={exemplarColor} key="triangle" d="M4 0L7.4641 6H0.535898L4 0Z" />,
    //   <rect fill={exemplarColor} key="rectangle" width="5" height="5" />,
    //   <path
    //     fill={exemplarColor}
    //     key="pentagon"
    //     d="M3 0.5L5.85317 2.57295L4.76336 5.92705H1.23664L0.146831 2.57295L3 0.5Z"
    //   />,
    //   <path
    //     fill={exemplarColor}
    //     key="plus"
    //     d="m2.35672,4.2425l0,2.357l1.88558,0l0,-2.357l2.3572,0l0,-1.88558l-2.3572,0l0,-2.35692l-1.88558,0l0,2.35692l-2.35672,0l0,1.88558l2.35672,0z"
    //   />,
    // ];

    // return symbols[dataFrameFieldIndex.frameIndex % symbols.length];
  };

  const lockExemplarModal = () => {
    setIsLocked(true);
  };

  const renderMarker = useCallback(() => {
    const onClose = () => {
      setIsLocked(false);
      setIsOpen(false);
      setClickedRowIndex(undefined);
    };

    let items: VizTooltipItem[] = [];
    let links: LinkModel[] = [];

    dataFrame.fields.forEach((field: Field) => {
      const value = field.values[rowIndex];

      links.push(...getDataLinks(field, rowIndex));

      const fieldDisplay = field.display?.(value) ?? { text: `${value}`, numeric: +value };

      items.push({
        label: field.state?.displayName ?? field.name,
        value: formattedValueToString(fieldDisplay),
      });
    });

    return (
      <div
        className={cx(styles.tooltipWrapper, isLocked && styles.pinned)}
        ref={refs.setFloating}
        style={floatingStyles}
        {...getFloatingProps()}
      >
        {isLocked && <CloseButton onClick={onClose} />}
        <ExemplarTooltip items={items} links={links} isPinned={isLocked} maxHeight={maxHeight} />
      </div>
    );
  }, [
    dataFrame.fields,
    rowIndex,
    styles,
    isLocked,
    setClickedRowIndex,
    floatingStyles,
    getFloatingProps,
    refs.setFloating,
    maxHeight,
  ]);

  const seriesColor = config.getSeries().find((s) => s.props.dataFrameFieldIndex?.frameIndex === frameIndex)
    ?.props.lineColor;

  const onExemplarClick = () => {
    setClickedRowIndex(rowIndex);
    lockExemplarModal();
  };

  return (
    <>
      <div
        ref={refs.setReference}
        className={styles.markerWrapper}
        data-testid={selectors.components.DataSource.Prometheus.exemplarMarker}
        role="button"
        tabIndex={0}
        {...getReferenceProps()}
        onClick={onExemplarClick}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === 'Enter') {
            onExemplarClick();
          }
        }}
      >
        <svg
          viewBox="0 0 7 7"
          width="7"
          height="7"
          style={{ fill: seriesColor }}
          className={cx(styles.marble, (isOpen || isLocked) && styles.activeMarble)}
        >
          {getSymbol()}
        </svg>
      </div>
      {(isOpen || isLocked) && <Portal>{renderMarker()}</Portal>}
    </>
  );
};

const getExemplarMarkerStyles = (theme: GrafanaTheme2, maxWidth: number | undefined) => {
  return {
    markerWrapper: css({
      padding: '0 4px 4px 4px',
      width: '8px',
      height: '8px',
      boxSizing: 'content-box',
      transform: 'translate3d(-50%, 0, 0)',
      '&:hover': {
        '> svg': {
          transform: 'scale(1.3)',
          opacity: 1,
          filter: 'drop-shadow(0 0 8px rgba(0, 0, 0, 0.5))',
        },
      },
    }),
    marker: css({
      width: 0,
      height: 0,
      borderLeft: '4px solid transparent',
      borderRight: '4px solid transparent',
      borderBottom: `4px solid ${theme.v1.palette.red}`,
      pointerEvents: 'none',
    }),
    marble: css({
      display: 'block',
      opacity: 0.5,
      [theme.transitions.handleMotion('no-preference')]: {
        transition: 'transform 0.15s ease-out',
      },
    }),
    activeMarble: css({
      transform: 'scale(1.3)',
      opacity: 1,
      filter: 'drop-shadow(0 0 8px rgba(0, 0, 0, 0.5))',
    }),
    tooltipWrapper: css({
      background: theme.colors.background.elevated,
      maxWidth: maxWidth ?? 'none',
      whiteSpace: 'pre',
      borderRadius: theme.shape.radius.default,
      position: 'fixed',
      border: `1px solid ${theme.colors.border.weak}`,
      boxShadow: theme.shadows.z2,
      userSelect: 'text',
    }),
    pinned: css({
      boxShadow: theme.shadows.z3,
    }),
  };
};
