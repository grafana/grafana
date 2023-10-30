import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, urlUtil } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { reportInteraction } from '@grafana/runtime';
import { ButtonSelect, useStyles2, ToolbarButton } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { createAndCopyShortLink } from 'app/core/utils/shortLinks';
import { useSelector } from 'app/types';

import { getUrlStateFromPaneState } from './hooks/useStateSync';
import { selectPanes } from './state/selectors';

export function ShortLinkButtonMenu() {
  const styles = useStyles2(getStyles);
  const panes = useSelector(selectPanes);
  const onCopyShortLink = (url?: string) => {
    createAndCopyShortLink(url || global.location.href);
    reportInteraction('grafana_explore_shortened_link_clicked');
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
      <ButtonSelect
        className={styles.buttonContainer}
        narrow={true}
        value={undefined}
        options={[
          { icon: 'link', label: 'Copy shortened URL', value: 'short-url' },
          {
            icon: 'clock-nine',
            label: 'Copy absolute time URL',
            description: 'Locks the current time for consistent viewing',
            value: 'short-url-abs-time',
          },
        ]}
        onChange={async (item) => {
          if (item.value === 'short-url') {
            onCopyShortLink();
          } else if (item.value === 'short-url-abs-time') {
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
          }
        }}
      />
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    buttonContainer: css`
      background-color: ${theme.colors.background.canvas};
    `,
  };
};
