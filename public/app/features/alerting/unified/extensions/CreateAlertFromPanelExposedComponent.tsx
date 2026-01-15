import { useAsync } from 'react-use';

import { locationUtil, urlUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';
import { Button, Modal } from '@grafana/ui';

import { vizPanelToRuleFormValues } from '../utils/rule-form';

export interface CreateAlertFromPanelProps {
  panel: VizPanel;
  onDismiss: () => void;
}

export function CreateAlertFromPanelExposedComponent({ panel, onDismiss }: CreateAlertFromPanelProps) {
  const { loading, value: formValues } = useAsync(() => vizPanelToRuleFormValues(panel), [panel]);

  const buildUrl = () => urlUtil.renderUrl('/alerting/new', { defaults: JSON.stringify(formValues) });

  const openInNewTab = () => {
    window.open(locationUtil.assureBaseUrl(buildUrl()), '_blank');
    onDismiss();
  };

  const openInCurrentTab = () => locationService.push(buildUrl());

  const canCreate = !loading && formValues;

  return (
    <Modal title={t('alerting.create-alert-from-panel.title', 'Create alert rule')} isOpen onDismiss={onDismiss}>
      <p>
        {canCreate ? (
          <Trans i18nKey="alerting.create-alert-from-panel.description">
            Open the alert creation form in the current tab or a new tab?
          </Trans>
        ) : (
          <Trans i18nKey="alerting.create-alert-from-panel.no-queries">
            No alerting-capable queries found in this panel.
          </Trans>
        )}
      </p>
      <Modal.ButtonRow>
        <Button onClick={onDismiss} fill="outline" variant="secondary">
          <Trans i18nKey="alerting.common.cancel">Cancel</Trans>
        </Button>
        {canCreate && (
          <>
            <Button variant="secondary" onClick={openInNewTab} icon="external-link-alt">
              <Trans i18nKey="alerting.create-alert-from-panel.open-in-new-tab">Open in new tab</Trans>
            </Button>
            <Button variant="primary" onClick={openInCurrentTab} icon="bell">
              <Trans i18nKey="alerting.create-alert-from-panel.open">Open</Trans>
            </Button>
          </>
        )}
      </Modal.ButtonRow>
    </Modal>
  );
}
