import { css, cx } from '@emotion/css';
import {
  autoUpdate,
  flip,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
} from '@floating-ui/react';
import { ReactElement, useState } from 'react';

import { ActionModel, GrafanaTheme2, LinkModel } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { Portal } from '../Portal/Portal';
import { VizTooltipFooter } from '../VizTooltip/VizTooltipFooter';
import { VizTooltipWrapper } from '../VizTooltip/VizTooltipWrapper';

interface Props {
  links: LinkModel[];
  actions?: ActionModel[];
  value?: string | ReactElement;
  children?: ReactElement;
}

/**
 *
 * @internal
 */
export const DataLinksActionsTooltip = ({ links, actions, value, children }: Props) => {
  const styles = useStyles2(getStyles);
  const [show, setShow] = useState(false);

  // the order of middleware is important!
  const middleware = [
    offset(16),
    flip({
      fallbackAxisSideDirection: 'end',
      // see https://floating-ui.com/docs/flip#combining-with-shift
      crossAxis: false,
      boundary: document.body,
    }),
    shift(),
  ];

  const { context, refs, floatingStyles } = useFloating({
    open: show,
    placement: 'bottom',
    onOpenChange: setShow,
    middleware,
    whileElementsMounted: autoUpdate,
  });

  const click = useClick(context);
  const dismiss = useDismiss(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss, click]);

  return (
    <>
      <span ref={refs.setReference} {...getReferenceProps()} className={styles.cursor}>
        {value ?? children}
      </span>
      {show && (
        <Portal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className={cx(styles.tooltipWrapper, styles.pinned)}
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

const getStyles = (theme: GrafanaTheme2) => {
  return {
    tooltipWrapper: css({
      top: 0,
      left: 0,
      zIndex: theme.zIndex.portal,
      whiteSpace: 'pre',
      borderRadius: theme.shape.radius.default,
      position: 'fixed',
      background: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      boxShadow: theme.shadows.z2,
      userSelect: 'text',
      padding: 0,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    pinned: css({
      boxShadow: theme.shadows.z3,
    }),
    cursor: css({
      cursor: 'pointer',
    }),
  };
};
