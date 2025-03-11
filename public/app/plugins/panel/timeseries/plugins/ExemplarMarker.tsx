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
import { CSSProperties, useCallback, useEffect, useState } from 'react';
import * as React from 'react';

import { DataFrame, DataFrameFieldIndex, Field, formattedValueToString, GrafanaTheme2, LinkModel } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { TimeZone } from '@grafana/schema';
import { Portal, UPlotConfigBuilder, useStyles2 } from '@grafana/ui';
import { DisplayValue } from 'app/features/visualization/data-hover/DataHoverView';
import { ExemplarHoverView } from 'app/features/visualization/data-hover/ExemplarHoverView';

import { ExemplarModalHeader } from '../../heatmap/ExemplarModalHeader';

interface ExemplarMarkerProps {
  timeZone: TimeZone;
  dataFrame: DataFrame;
  dataFrameFieldIndex: DataFrameFieldIndex;
  config: UPlotConfigBuilder;
  exemplarColor?: string;
  clickedExemplarFieldIndex: DataFrameFieldIndex | undefined;
  setClickedExemplarFieldIndex: React.Dispatch<DataFrameFieldIndex | undefined>;
  maxHeight?: number;
}

export const ExemplarMarker = ({
  timeZone,
  dataFrame,
  dataFrameFieldIndex,
  config,
  exemplarColor,
  clickedExemplarFieldIndex,
  setClickedExemplarFieldIndex,
  maxHeight,
}: ExemplarMarkerProps) => {
  const styles = useStyles2(getExemplarMarkerStyles);
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
    enabled: clickedExemplarFieldIndex === undefined,
  });

  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss, hover]);

  useEffect(() => {
    if (
      !(
        clickedExemplarFieldIndex?.fieldIndex === dataFrameFieldIndex.fieldIndex &&
        clickedExemplarFieldIndex?.frameIndex === dataFrameFieldIndex.frameIndex
      )
    ) {
      setIsLocked(false);
    }
  }, [clickedExemplarFieldIndex, dataFrameFieldIndex]);

  const getSymbol = () => {
    const symbols = [
      <rect
        fill={exemplarColor}
        key="diamond"
        x="3.38672"
        width="4.78985"
        height="4.78985"
        transform="rotate(45 3.38672 0)"
      />,
      <path
        fill={exemplarColor}
        key="x"
        d="M1.94444 3.49988L0 5.44432L1.55552 6.99984L3.49996 5.05539L5.4444 6.99983L6.99992 5.44431L5.05548 3.49988L6.99983 1.55552L5.44431 0L3.49996 1.94436L1.5556 0L8.42584e-05 1.55552L1.94444 3.49988Z"
      />,
      <path fill={exemplarColor} key="triangle" d="M4 0L7.4641 6H0.535898L4 0Z" />,
      <rect fill={exemplarColor} key="rectangle" width="5" height="5" />,
      <path
        fill={exemplarColor}
        key="pentagon"
        d="M3 0.5L5.85317 2.57295L4.76336 5.92705H1.23664L0.146831 2.57295L3 0.5Z"
      />,
      <path
        fill={exemplarColor}
        key="plus"
        d="m2.35672,4.2425l0,2.357l1.88558,0l0,-2.357l2.3572,0l0,-1.88558l-2.3572,0l0,-2.35692l-1.88558,0l0,2.35692l-2.35672,0l0,1.88558l2.35672,0z"
      />,
    ];

    return symbols[dataFrameFieldIndex.frameIndex % symbols.length];
  };

  const lockExemplarModal = () => {
    setIsLocked(true);
  };

  const renderMarker = useCallback(() => {
    //Put fields with links on the top
    const fieldsWithLinks =
      dataFrame.fields.filter((field) => field.config.links?.length && field.config.links?.length > 0) || [];
    const orderedDataFrameFields = [
      ...fieldsWithLinks,
      ...dataFrame.fields.filter((field) => !fieldsWithLinks.includes(field)),
    ];

    const onClose = () => {
      setIsLocked(false);
      setIsOpen(false);
      setClickedExemplarFieldIndex(undefined);
    };

    let displayValues: DisplayValue[] = [];
    let links: LinkModel[] | undefined = [];
    orderedDataFrameFields.map((field: Field, i) => {
      const value = field.values[dataFrameFieldIndex.fieldIndex];

      if (field.config.links?.length) {
        links?.push(...(field.getLinks?.({ valueRowIndex: dataFrameFieldIndex.fieldIndex }) || []));
      }

      const fieldDisplay = field.display ? field.display(value) : { text: `${value}`, numeric: +value };

      displayValues.push({
        name: field.name,
        value,
        valueString: formattedValueToString(fieldDisplay),
        highlight: false,
      });
    });

    const exemplarHeaderCustomStyle: CSSProperties = {
      position: 'relative',
      top: '35px',
      right: '5px',
      marginRight: 0,
    };

    return (
      <div className={styles.tooltip} ref={refs.setFloating} style={floatingStyles} {...getFloatingProps()}>
        {isLocked && <ExemplarModalHeader onClick={onClose} style={exemplarHeaderCustomStyle} />}
        <ExemplarHoverView displayValues={displayValues} links={links} maxHeight={maxHeight} />
      </div>
    );
  }, [
    dataFrame.fields,
    dataFrameFieldIndex,
    styles,
    isLocked,
    setClickedExemplarFieldIndex,
    floatingStyles,
    getFloatingProps,
    refs.setFloating,
    maxHeight,
  ]);

  const seriesColor = config
    .getSeries()
    .find((s) => s.props.dataFrameFieldIndex?.frameIndex === dataFrameFieldIndex.frameIndex)?.props.lineColor;

  const onExemplarClick = () => {
    setClickedExemplarFieldIndex(dataFrameFieldIndex);
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

const getExemplarMarkerStyles = (theme: GrafanaTheme2) => {
  const bg = theme.isDark ? theme.v1.palette.dark2 : theme.v1.palette.white;
  const headerBg = theme.isDark ? theme.v1.palette.dark9 : theme.v1.palette.gray5;
  const shadowColor = theme.isDark ? theme.v1.palette.black : theme.v1.palette.white;
  const tableBgOdd = theme.isDark ? theme.v1.palette.dark3 : theme.v1.palette.gray6;

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
    wrapper: css({
      background: bg,
      border: `1px solid ${headerBg}`,
      borderRadius: theme.shape.borderRadius(2),
      boxShadow: `0 0 20px ${shadowColor}`,
      padding: theme.spacing(1),
    }),
    exemplarsTable: css({
      width: '100%',
      'tr td': {
        padding: '5px 10px',
        whiteSpace: 'nowrap',
        borderBottom: `4px solid ${theme.components.panel.background}`,
      },
      tr: {
        backgroundColor: theme.colors.background.primary,
        '&:nth-child(even)': {
          backgroundColor: tableBgOdd,
        },
      },
    }),
    valueWrapper: css({
      display: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: theme.spacing(1),
      '> span': {
        flexGrow: 0,
      },
      '> *': {
        flex: '1 1',
        alignSelf: 'center',
      },
    }),
    tooltip: css({
      background: 'none',
      padding: 0,
      overflowY: 'auto',
      maxHeight: '95vh',
      boxShadow: theme.shadows.z2,
    }),
    header: css({
      background: headerBg,
      padding: '6px 10px',
      display: 'flex',
    }),
    title: css({
      fontWeight: theme.typography.fontWeightMedium,
      paddingRight: theme.spacing(2),
      overflow: 'hidden',
      display: 'inline-block',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
      flexGrow: 1,
    }),
    body: css({
      fontWeight: theme.typography.fontWeightMedium,
      borderRadius: theme.shape.borderRadius(2),
      overflow: 'hidden',
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
  };
};
