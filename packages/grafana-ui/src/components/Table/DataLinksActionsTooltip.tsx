import { css } from '@emotion/css';
import { useDismiss, useFloating, useInteractions } from '@floating-ui/react';
import { useMemo, type ReactNode } from 'react';

import { type ActionModel, type GrafanaTheme2, type LinkModel } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useStyles2, useTheme2 } from '../../themes/ThemeContext';
import { getPositioningMiddleware } from '../../utils/floating';
import { Menu } from '../Menu/Menu';
import { Portal } from '../Portal/Portal';
import { VizTooltipFooter } from '../VizTooltip/VizTooltipFooter';
import { VizTooltipWrapper } from '../VizTooltip/VizTooltipWrapper';

import { type DataLinksActionsTooltipCoords } from './cellUtils';

interface Props {
  links: LinkModel[];
  actions?: ActionModel[];
  value?: ReactNode;
  coords: DataLinksActionsTooltipCoords;
  onTooltipClose?: () => void;
  /** Styles links as menu items, to match the refreshed cell actions menu. */
  tableRefreshEnabled?: boolean;
}

/**
 *
 * @internal
 */
export const DataLinksActionsTooltip = ({
  links,
  actions,
  value,
  coords,
  onTooltipClose,
  tableRefreshEnabled,
}: Props) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const placement = 'right-start';

  // the order of middleware is important!
  const middleware = getPositioningMiddleware(placement);

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
    placement,
    onOpenChange: onTooltipClose,
    middleware,
    // whileElementsMounted: autoUpdate,
  });

  const dismiss = useDismiss(context);

  const { getFloatingProps, getReferenceProps } = useInteractions([dismiss]);

  if (links.length === 0 && !Boolean(actions?.length)) {
    return null;
  }

  // One-click items keep the footer's "Click to open" hint instead of a list.
  const hasOneClick = links.some((link) => link.oneClick) || Boolean(actions?.some((action) => action.oneClick));
  const showLinkMenu = tableRefreshEnabled && links.length > 0 && !hasOneClick;

  return (
    <>
      {/* TODO: we can remove `value` from this component when TableRT is fully deprecated */}
      {value}
      <Portal zIndex={theme.zIndex.tooltip}>
        <div
          ref={refCallback}
          {...getReferenceProps()}
          {...getFloatingProps()}
          style={floatingStyles}
          className={showLinkMenu ? styles.linkMenu : styles.tooltipWrapper}
          data-testid={selectors.components.DataLinksActionsTooltip.tooltipWrapper}
        >
          {showLinkMenu ? (
            <>
              <Menu
                onKeyDownCapture={(event) => {
                  // Keep footer actions reachable and avoid handling Space in both Menu and MenuItem.
                  if (event.key === 'Tab') {
                    event.stopPropagation();
                  } else if (event.key === ' ' && event.target instanceof HTMLAnchorElement) {
                    event.preventDefault();
                    event.stopPropagation();
                    event.target.click();
                  }
                }}
              >
                {links.map((link, i) => (
                  <Menu.Item
                    key={i}
                    label={link.title}
                    url={link.href}
                    target={link.target}
                    icon={link.target === '_blank' ? 'external-link-alt' : 'link'}
                    onClick={(event) => {
                      if (link.onClick && !(event.ctrlKey || event.metaKey || event.shiftKey)) {
                        event.preventDefault();
                        link.onClick(event);
                      }
                    }}
                  />
                ))}
              </Menu>
              {Boolean(actions?.length) && (
                <VizTooltipWrapper>
                  <VizTooltipFooter actions={actions} />
                </VizTooltipWrapper>
              )}
            </>
          ) : (
            <VizTooltipWrapper>
              <VizTooltipFooter dataLinks={links} actions={actions} />
            </VizTooltipWrapper>
          )}
        </div>
      </Portal>
    </>
  );
};

export const renderSingleLink = (link: LinkModel, children: ReactNode, className?: string): ReactNode => {
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
      whiteSpace: 'pre',
      borderRadius: theme.shape.radius.default,
      background: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      boxShadow: theme.flags.visualDesignRefresh ? theme.shadows.z2 : theme.shadows.z3,
      maxHeight: `calc(100vh - ${theme.spacing(4)})`,
      overflowX: 'hidden',
      userSelect: 'text',
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    linkMenu: css({
      ...theme.typography.body,
      maxWidth: `calc(100vw - ${theme.spacing(4)})`,
      '& > [role="menu"]': {
        maxWidth: '100%',
        maxHeight: `calc(100vh - ${theme.spacing(4)})`,
        overflowY: 'auto',
      },
      '& a, & a span': {
        overflowWrap: 'anywhere',
        whiteSpace: 'normal',
      },
    }),
  };
};
