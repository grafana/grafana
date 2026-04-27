import { css } from '@emotion/css';
import type { JSX } from 'react';

import type { GrafanaTheme2 } from '@grafana/data/themes';
import type { DataLink, LinkModel } from '@grafana/data/types';
import { t } from '@grafana/i18n';
import { Dropdown, Menu, ToolbarButton, PanelChrome } from '@grafana/ui';
import { Icon } from '@grafana/ui/components/icons';
import { useStyles2 } from '@grafana/ui/themes';

interface Props {
  panelLinks: DataLink[];
  onShowPanelLinks: () => LinkModel[];
}

export function PanelLinks({ panelLinks, onShowPanelLinks }: Props) {
  const styles = useStyles2(getStyles);

  const getLinksContent = (): JSX.Element => {
    const interpolatedLinks = onShowPanelLinks();
    return (
      <Menu>
        {interpolatedLinks?.map((link, idx) => {
          return <Menu.Item key={idx} label={link.title} url={link.href} target={link.target} onClick={link.onClick} />;
        })}
      </Menu>
    );
  };

  if (panelLinks.length === 1) {
    const linkModel = onShowPanelLinks()[0];
    return (
      <PanelChrome.TitleItem
        href={linkModel.href}
        onClick={linkModel.onClick}
        target={linkModel.target}
        title={linkModel.title}
      >
        <Icon name="external-link-alt" size="md" />
      </PanelChrome.TitleItem>
    );
  } else {
    return (
      <Dropdown overlay={getLinksContent}>
        <ToolbarButton
          icon="external-link-alt"
          iconSize="md"
          aria-label={t('dashboard.panel-links.aria-label-panel-links', 'Panel links')}
          className={styles.menuTrigger}
        />
      </Dropdown>
    );
  }
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    menuTrigger: css({
      height: '100%',
      background: 'inherit',
      border: 'none',
      borderRadius: `${theme.shape.radius.default}`,
      cursor: 'context-menu',
    }),
  };
};
