import { css } from '@emotion/css';
import React, { useState } from 'react';

import { config, reportInteraction } from '@grafana/runtime';
import { useStyles2, MenuItem, Icon, ContextMenu } from '@grafana/ui';

import { SpanLinkDef } from '../types/links';

interface SpanLinksProps {
  links: SpanLinkDef[];
  datasourceType: string;
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
      className={styles.menuItem}
    />
  ));
};

export const SpanLinksMenu = ({ links, datasourceType }: SpanLinksProps) => {
  const styles = useStyles2(getStyles);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <div data-testid="SpanLinksMenu">
      <button
        onClick={(e) => {
          setIsMenuOpen(true);
          setMenuPosition({
            x: e.pageX,
            y: e.pageY,
          });
        }}
        className={styles.button}
      >
        <Icon name="link" className={styles.button} />
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

const getStyles = () => {
  return {
    button: css`
      background: transparent;
      border: none;
      padding: 0;
      margin: 0 3px 0 0;
    `,
    menuItem: css`
      max-width: 60ch;
      overflow: hidden;
    `,
  };
};
