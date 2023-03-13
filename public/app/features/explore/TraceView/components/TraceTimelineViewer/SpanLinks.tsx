import { css } from '@emotion/css';
import React, { useState } from 'react';

import { config, reportInteraction } from '@grafana/runtime';
import { useStyles2, MenuGroup, MenuItem, Icon, ContextMenu } from '@grafana/ui';

import { SpanLinks } from '../types/links';

interface SpanLinksProps {
  links: SpanLinks;
  datasourceType: string;
}

const renderMenuItems = (
  links: SpanLinks,
  styles: ReturnType<typeof getStyles>,
  closeMenu: () => void,
  datasourceType: string
) => {
  return (
    <>
      {!!links.logLinks?.length ? (
        <MenuGroup label="Logs">
          {links.logLinks.map((link, i) => (
            <MenuItem
              key={i}
              label="Logs for this span"
              onClick={
                link.onClick
                  ? (event) => {
                      reportInteraction('grafana_traces_trace_view_span_link_clicked', {
                        datasourceType: datasourceType,
                        grafana_version: config.buildInfo.version,
                        type: 'log',
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
          ))}
        </MenuGroup>
      ) : null}
      {!!links.metricLinks?.length ? (
        <MenuGroup label="Metrics">
          {links.metricLinks.map((link, i) => (
            <MenuItem
              key={i}
              label={link.title ?? 'Metrics for this span'}
              onClick={
                link.onClick
                  ? (event) => {
                      reportInteraction('grafana_traces_trace_view_span_link_clicked', {
                        datasourceType: datasourceType,
                        grafana_version: config.buildInfo.version,
                        type: 'metric',
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
          ))}
        </MenuGroup>
      ) : null}
      {!!links.traceLinks?.length ? (
        <MenuGroup label="Traces">
          {links.traceLinks.map((link, i) => (
            <MenuItem
              key={i}
              label={link.title ?? 'View linked span'}
              onClick={
                link.onClick
                  ? (event) => {
                      reportInteraction('grafana_traces_trace_view_span_link_clicked', {
                        datasourceType: datasourceType,
                        grafana_version: config.buildInfo.version,
                        type: 'trace',
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
          ))}
        </MenuGroup>
      ) : null}
    </>
  );
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
          focusOnOpen={true}
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
