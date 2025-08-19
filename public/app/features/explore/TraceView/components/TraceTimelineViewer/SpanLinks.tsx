import { css } from '@emotion/css';
import { useState } from 'react';

import { config, reportInteraction } from '@grafana/runtime';
import { useStyles2, MenuItem, Icon, ContextMenu } from '@grafana/ui';

import { SpanLinkDef } from '../types/links';

interface SpanLinksProps {
  links: SpanLinkDef[];
  datasourceType: string;
  color: string;
}

const renderMenuItems = (
  links: SpanLinkDef[],
  styles: ReturnType<typeof getStyles>,
  closeMenu: () => void,
  datasourceType: string
) => {
  links.sort(function (linkA, linkB) {
    return (linkA.title || 'link').toLowerCase().localeCompare((linkB.title || 'link').toLowerCase());
  });

  return links.map((link, i) => (
    <MenuItem
      key={i}
      label={link.title || 'Link'}
      onClick={
        link.onClick
          ? (event) => {
              reportInteraction(`grafana_traces_trace_view_span_link_clicked`, {
                datasourceType: datasourceType,
                grafana_version: config.buildInfo.version,
                type: link.type,
                location: 'menu',
              });
              event?.preventDefault();
              link.onClick!(event);
              closeMenu();
            }
          : undefined
      }
      url={link.href}
      target={link.target}
      className={styles.menuItem}
    />
  ));
};

export const SpanLinksMenu = ({ links, datasourceType, color }: SpanLinksProps) => {
  const styles = useStyles2(() => getStyles(color));
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <div data-testid="SpanLinksMenu" className={styles.wrapper}>
      <button
        onClick={(e) => {
          setIsMenuOpen(true);
          setMenuPosition({
            x: e.clientX,
            y: e.clientY,
          });
        }}
        className={styles.button}
      >
        <Icon name="link" className={styles.icon} />
      </button>

      {isMenuOpen ? (
        <ContextMenu
          onClose={() => setIsMenuOpen(false)}
          renderMenuItems={() => renderMenuItems(links, styles, closeMenu, datasourceType)}
          focusOnOpen={false}
          x={menuPosition.x}
          y={menuPosition.y}
        />
      ) : null}
    </div>
  );
};

const getStyles = (color: string) => ({
  wrapper: css({
    border: 'none',
    background: `${color}10`,
    borderBottom: `1px solid ${color}CF`,
    paddingRight: '4px',
  }),
  button: css({
    background: 'transparent',
    border: 'none',
    padding: 0,
  }),
  icon: css({
    background: 'transparent',
    border: 'none',
    padding: 0,
  }),
  menuItem: css({
    maxWidth: '60ch',
    overflow: 'hidden',
  }),
});
