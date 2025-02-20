import { css } from '@emotion/css';
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
}

/**
 *
 * @internal
 */
export const DataLinksActionsTooltip = ({ links, actions, value }: Props) => {
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

  const onItemClick = () => {
    if (hasMultipleLinksOrActions) {
      setShow(true);
    }
  };

  const hasMultipleLinksOrActions = links.length > 1 || Boolean(actions?.length);

  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss, click]);

  if (links.length === 0 && !Boolean(actions?.length)) {
    return null;
  }

  if (links.length === 1) {
    const primaryLink = links[0];
    return (
      <a
        href={primaryLink.href}
        onClick={primaryLink.onClick}
        target={primaryLink.target}
        title={primaryLink.title}
        className={styles.link}
      >
        {value}
      </a>
    );
  } else {
    return (
      <>
        <span
          ref={refs.setReference}
          {...getReferenceProps()}
          className={styles.link}
          onClick={onItemClick}
          style={{ cursor: 'context-menu' }}
        >
          {value}
        </span>
        {show && hasMultipleLinksOrActions && (
          <Portal>
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              {...getFloatingProps()}
              className={styles.tooltipWrapper}
            >
              <VizTooltipWrapper>
                <VizTooltipFooter dataLinks={links} actions={actions} />
              </VizTooltipWrapper>
            </div>
          </Portal>
        )}
      </>
    );
  }
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
    link: css({
      cursor: 'pointer',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      userSelect: 'text',
      whiteSpace: 'nowrap',
      fontWeight: theme.typography.fontWeightMedium,
      paddingRight: theme.spacing(1.5),
      color: `${theme.colors.text.link} !important`,
      '&:hover': {
        textDecoration: 'underline',
      },
    }),
  };
};
