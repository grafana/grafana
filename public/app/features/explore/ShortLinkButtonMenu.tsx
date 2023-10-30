import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2, urlUtil } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { reportInteraction } from '@grafana/runtime';
import { useStyles2, ToolbarButton, Dropdown, Menu } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { createAndCopyShortLink } from 'app/core/utils/shortLinks';
import { useSelector } from 'app/types';

import { getUrlStateFromPaneState } from './hooks/useStateSync';
import { selectPanes } from './state/selectors';

export function ShortLinkButtonMenu() {
  const styles = useStyles2(getStyles);
  const panes = useSelector(selectPanes);
  const [isOpen, setIsOpen] = useState(false);
  const onCopyShortLink = (url?: string) => {
    createAndCopyShortLink(url || global.location.href);
    reportInteraction('grafana_explore_shortened_link_clicked');
  };

  const MenuActions = () => {
    return (
      <Menu>
        <Menu.Item
          key="copy-link"
          label="Copy shortened URL"
          icon="link"
          onClick={() => onCopyShortLink()}
          className={styles.menuItem}
        />
        <Menu.Item
          key="copy-link-abs-time"
          label="Copy absolute time URL"
          icon="clock-nine"
          description="Locks the current time for consistent viewing"
          onClick={() => {
            const exploreIds = Object.keys(panes);
            const urlStates = Object.values(panes)
              .map((pane, i) => {
                if (pane) {
                  const urlState = getUrlStateFromPaneState(pane);
                  urlState.range = {
                    to: pane.range.to.valueOf().toString(),
                    from: pane.range.from.valueOf().toString(),
                  };
                  return JSON.stringify({ [exploreIds[i]]: { ...urlState } });
                } else {
                  return undefined;
                }
              })
              .filter((urlState) => urlState !== undefined) as string[];
            onCopyShortLink(urlUtil.renderUrl('/explore', { panes: urlStates, schemaVersion: 1 }));
          }}
          className={styles.menuItem}
        />
      </Menu>
    );
  };

  // we need the Toolbar button click to be an action separate from opening/closing the menu
  return (
    <Stack gap={0} direction="row" alignItems="baseline" wrap={false}>
      <ToolbarButton
        className={styles.buttonContainer}
        tooltip={t('explore.toolbar.copy-shortened-link', 'Copy shortened link')}
        icon="share-alt"
        iconOnly={true}
        narrow={true}
        onClick={() => onCopyShortLink()}
        aria-label={t('explore.toolbar.copy-shortened-link', 'Copy shortened link')}
      />
      <Dropdown overlay={MenuActions} placement="bottom-end" onVisibleChange={setIsOpen}>
        <ToolbarButton
          className={styles.buttonContainer}
          narrow={true}
          isOpen={isOpen}
          aria-label={t('explore.toolbar.copy-shortened-link', 'Copy shortened link')}
        />
      </Dropdown>
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    buttonContainer: css({
      backgroundColor: theme.colors.background.canvas,
    }),
    menuItem: css({
      alignItems: 'start',
      '>:nth-child(2)': {
        marginLeft: theme.spacing(3),
      },
    }),
  };
};
