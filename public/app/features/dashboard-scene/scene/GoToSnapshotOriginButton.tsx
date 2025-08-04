import { css } from '@emotion/css';

import { textUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, locationService } from '@grafana/runtime';
import { ConfirmModal, ToolbarButton } from '@grafana/ui';

import appEvents from '../../../core/app_events';
import { ShowModalReactEvent } from '../../../types/events';

export function GoToSnapshotOriginButton(props: { originalURL: string }) {
  return (
    <ToolbarButton
      key="button-snapshot"
      data-testid="button-snapshot"
      tooltip={t('dashboard.toolbar.open-original', 'Open original dashboard')}
      icon="link"
      onClick={() => onOpenSnapshotOriginalDashboard(props.originalURL)}
    />
  );
}

const onOpenSnapshotOriginalDashboard = (originalUrl: string) => {
  const relativeURL = originalUrl ?? '';
  const sanitizedRelativeURL = textUtil.sanitizeUrl(relativeURL);
  try {
    const sanitizedAppUrl = new URL(sanitizedRelativeURL, config.appUrl);
    const appUrl = new URL(config.appUrl);
    if (sanitizedAppUrl.host !== appUrl.host) {
      appEvents.publish(
        new ShowModalReactEvent({
          component: ConfirmModal,
          props: {
            title: t(
              'dashboard-scene.on-open-snapshot-original-dashboard.title.proceed-to-external-site',
              'Proceed to external site?'
            ),
            modalClass: css({
              width: 'max-content',
              maxWidth: '80vw',
            }),
            body: (
              <>
                <p>
                  {`This link connects to an external website at`} <code>{relativeURL}</code>
                </p>
                <p>{"Are you sure you'd like to proceed?"}</p>
              </>
            ),
            confirmVariant: 'primary',
            confirmText: t('dashboard-scene.on-open-snapshot-original-dashboard.confirmText.proceed', 'Proceed'),
            onConfirm: () => {
              window.location.href = sanitizedAppUrl.href;
            },
          },
        })
      );
    } else {
      locationService.push(sanitizedRelativeURL);
    }
  } catch (err) {
    console.error('Failed to open original dashboard', err);
  }
};
