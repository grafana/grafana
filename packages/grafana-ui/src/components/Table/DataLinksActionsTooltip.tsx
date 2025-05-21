import { css } from '@emotion/css';
import { flip, shift, useDismiss, useFloating, useInteractions } from '@floating-ui/react';
import { ReactElement, useMemo } from 'react';
import * as React from 'react';

import { ActionModel, GrafanaTheme2, LinkModel } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useStyles2 } from '../../themes';
import { Portal } from '../Portal/Portal';
import { VizTooltipFooter } from '../VizTooltip/VizTooltipFooter';
import { VizTooltipWrapper } from '../VizTooltip/VizTooltipWrapper';

import { DataLinksActionsTooltipCoords } from './utils';

interface Props {
  links: LinkModel[];
  actions?: ActionModel[];
  value?: string | ReactElement;
  coords: DataLinksActionsTooltipCoords;
  onTooltipClose?: () => void;
}

/**
 *
 * @internal
 */
export const DataLinksActionsTooltip = ({ links, actions, value, coords, onTooltipClose }: Props) => {
  const styles = useStyles2(getStyles);

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

  const virtual = useMemo(() => {
    const { clientX, clientY } = coords;

    // https://floating-ui.com/docs/virtual-elements
    return {
      getBoundingClientRect() {
        return {
          width: 0,
          height: 0,
          x: clientX,
          y: clientY,
          top: clientY,
          left: clientX,
          right: clientX,
          bottom: clientY,
        };
      },
    };
  }, [coords]);

  const refCallback = (el: HTMLDivElement) => {
    refs.setFloating(el);
    refs.setReference(virtual);
  };

  const { context, refs, floatingStyles } = useFloating({
    open: true,
    placement: 'right-start',
    onOpenChange: onTooltipClose,
    middleware,
    // whileElementsMounted: autoUpdate,
  });

  const dismiss = useDismiss(context);

  const hasMultipleLinksOrActions = links.length > 1 || Boolean(actions?.length);

  const { getFloatingProps, getReferenceProps } = useInteractions([dismiss]);

  if (links.length === 0 && !Boolean(actions?.length)) {
    return null;
  }

  return (
    <>
      {value}
      {hasMultipleLinksOrActions && (
        <Portal>
          <div
            ref={refCallback}
            {...getReferenceProps({ onClick: (e) => e.stopPropagation() })}
            {...getFloatingProps()}
            style={floatingStyles}
            className={styles.tooltipWrapper}
            data-testid={selectors.components.DataLinksActionsTooltip.tooltipWrapper}
          >
            <VizTooltipWrapper>
              <VizTooltipFooter dataLinks={links} actions={actions} />
            </VizTooltipWrapper>
          </div>
        </Portal>
      )}
    </>
  );
};

export const renderSingleLink = (
  link: LinkModel,
  children: string | React.JSX.Element,
  className?: string
): React.JSX.Element => {
  return (
    <a
      href={link.href}
      onClick={link.onClick}
      target={link.target}
      title={link.title}
      data-testid={selectors.components.DataLinksContextMenu.singleLink}
      className={className}
    >
      {children}
    </a>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    tooltipWrapper: css({
      zIndex: theme.zIndex.portal,
      whiteSpace: 'pre',
      borderRadius: theme.shape.radius.default,
      background: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      boxShadow: theme.shadows.z3,
      userSelect: 'text',
      fontSize: theme.typography.bodySmall.fontSize,
    }),
  };
};
