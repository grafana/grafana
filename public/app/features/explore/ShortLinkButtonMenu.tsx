import React from 'react';

import { urlUtil } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { ButtonSelect } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { createAndCopyShortLink } from 'app/core/utils/shortLinks';
import { useSelector } from 'app/types';

import { DashNavButton } from '../dashboard/components/DashNav/DashNavButton';

import { getUrlStateFromPaneState } from './hooks/useStateSync';
import { selectPanes } from './state/selectors';

export function ShortLinkButtonMenu() {
  const panes = useSelector(selectPanes);
  const onCopyShortLink = (url?: string) => {
    console.log(url || global.location.href);
    createAndCopyShortLink(url || global.location.href);
    reportInteraction('grafana_explore_shortened_link_clicked');
  };

  return (
    <>
      <DashNavButton
        tooltip={t('explore.toolbar.copy-shortened-link', 'Copy shortened link')}
        icon="share-alt"
        onClick={() => onCopyShortLink()}
        aria-label={t('explore.toolbar.copy-shortened-link', 'Copy shortened link')}
      />
      <ButtonSelect
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
                  urlState.range = { to: pane.range.to.valueOf().toString(), from: pane.range.to.valueOf().toString() };
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
    </>
  );
}
