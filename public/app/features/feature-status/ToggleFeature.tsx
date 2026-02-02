/*
 * Copyright (C) 2022-2025 BMC Helix Inc
 * Added by ymulthan at 4/12/2022
 */

import { css } from '@emotion/css';
import { forOwn as _forOwn, pick as _pick } from 'lodash';
import { FC, useState } from 'react';

import { GrafanaTheme } from '@grafana/data';
import { Field, FieldSet, Icon, stylesFactory, Switch, useTheme, Modal, Button } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import {
  updateFeatureStatus,
  loadGrafanaFeatures,
  getGrafanaFeaturesList,
} from 'app/features/dashboard/services/featureFlagSrv';

const notifyForSkipOotb = 'Skip OOTB dashboards during upgrade';

const toggleFeatureStatus = async (featureName: string, status: boolean) => {
  await updateFeatureStatus({ featureName, status });
  await loadGrafanaFeatures();
  return;
};

const ToggleFeature: FC<any> = () => {
  const [loadingFeatures, setLoadingFeatures] = useState<Set<string>>(new Set());
  const [confirmDialogVisible, setConfirmDialogVisible] = useState<boolean>(false);
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const theme = useTheme();
  const styles = getStyles(theme);
  const featuresMap = getGrafanaFeaturesList();
  const sortedFeatures = (featuresMap && _pick(featuresMap, Object.keys(featuresMap).sort())) ?? {};
  const featuresList: any = [];

  const onConfirmEnableFeature = async () => {
    setIsProcessing(true);
    try {
      await toggleFeatureStatus(selectedFeature!, true);
      await loadGrafanaFeatures();

      setConfirmDialogVisible(false);
      setSelectedFeature(null);
    } finally {
      setIsProcessing(false);
      // BMC Code : Accessibility Change (Next 1 line)
      setTimeout(() => location.reload(), 500);
    }
  };

  const onCancel = () => {
    if (selectedFeature !== null) {
      loadingFeatures.delete(selectedFeature);
      setLoadingFeatures(new Set(loadingFeatures));
    }
    setConfirmDialogVisible(false);
    setSelectedFeature(null);
  };

  _forOwn(sortedFeatures, (val, key) => {
    featuresList.push(
      <Field label={key} horizontal key={key} className={styles.item}>
        {loadingFeatures.has(key) ? (
          <Icon name="fa fa-spinner" size="sm" />
        ) : (
          <Switch
            value={val.val}
            label={key}
            onChange={() => {
              loadingFeatures.add(key);
              setLoadingFeatures(new Set(loadingFeatures));
              if (!val.val && key === notifyForSkipOotb) {
                setSelectedFeature(val.key);
                setConfirmDialogVisible(true);
              } else {
                toggleFeatureStatus(val.key, !val.val)
                  .then(() => {
                    // BMC Code : Accessibility Change (Next 1 line)
                    setTimeout(() => location.reload(), 500);
                  })
                  .finally(() => {
                    loadingFeatures.delete(key);
                    setLoadingFeatures(new Set(loadingFeatures));
                  });
              }
            }}
          />
        )}
      </Field>
    );
  });
  return (
    <div className={styles.container}>
      {
        <FieldSet label={t('bmc.toggle-feature.manage-features', 'Manage dashboard features')} disabled={false}>
          {featuresList}
        </FieldSet>
      }
      {confirmDialogVisible && (
        <Modal
          title={t('bmc.features-list.skip-ootb-dashboards-during-upgrade-confirm-dialog.title', 'Toggle Feature')}
          isOpen={confirmDialogVisible}
          onDismiss={onCancel}
        >
          <Trans i18nKey="bmc.features-list.skip-ootb-dashboards-during-upgrade-confirm-dialog.desc">
            Delete the folders of out-of-the-box dashboards that are not required before enabling this feature
          </Trans>
          <div>
            <Modal.ButtonRow>
              <Button variant="secondary" onClick={onCancel}>
                <Trans i18nKey="bmc.common.cancel">Cancel</Trans>
              </Button>
              <Button variant="primary" onClick={onConfirmEnableFeature} disabled={isProcessing}>
                {isProcessing ? (
                  <Icon name="fa fa-spinner" size="sm" />
                ) : (
                  <Trans i18nKey="bmc.features-list.skip-ootb-dashboards-during-upgrade-confirm-dialog.confirm-button">
                    Enable
                  </Trans>
                )}
              </Button>
            </Modal.ButtonRow>
          </div>
        </Modal>
      )}
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    container: css`
      max-width: 600px;
      width: 100%;
    `,
    spinner: css`
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100px;
    `,
    item: css`
      border: 1px solid ${theme.colors.border1};
      border-radius: 2px;
      padding: 5px;
    `,
  };
});

export default ToggleFeature;
