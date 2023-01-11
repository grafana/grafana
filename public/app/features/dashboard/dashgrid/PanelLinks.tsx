import { css } from '@emotion/css';
import React from 'react';

import { LinkModel } from '@grafana/data';
import { Dropdown, Menu, ToolbarButton } from '@grafana/ui';

interface Props {
  links: (() => LinkModel[]) | undefined;
}

export function PanelLinks({ links }: Props) {
  const styles = getStyles();

  const getLinksContent = (): JSX.Element => {
    const panelLinks = links && links();
    return (
      <Menu>
        {panelLinks?.map((link, idx) => {
          return <Menu.Item key={idx} label={link.title} url={link.href} target={link.target} />;
        })}
      </Menu>
    );
  };

  return links ? (
    <Dropdown overlay={getLinksContent}>
      <ToolbarButton icon="external-link-alt" aria-label="panel links" className={styles.item} />
    </Dropdown>
  ) : null;
}

const getStyles = () => {
  return {
    item: css({
      border: 'none',
    }),
  };
};
