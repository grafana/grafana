import { css } from '@emotion/css';
import React, { FC } from 'react';

import { GrafanaTheme, GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Button, HorizontalGroup, Modal, stylesFactory, useTheme, CollapsableSection, useTheme2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { exportDashboards as _exportDashboards } from 'app/features/manage-dashboards/state/actions';

import { OnMoveOrDeleleSelectedItems } from '../../types';

interface Props {
  onExportDone: OnMoveOrDeleleSelectedItems;
  results: string[];
  isOpen: boolean;
  onDismiss: () => void;
}

export const ConfirmExportModal: FC<Props> = ({ onExportDone, results, isOpen, onDismiss }) => {
  const theme = useTheme();
  const theme2 = useTheme2();
  const styles = getStyles(theme, theme2);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const dashboards = results;
  const dashCount = dashboards.length;
  const bulkExportLimit = (config.bootData.settings as any).bulkExportLimit ?? 100;
  const bulkExportLimitMsg = `Select upto ${bulkExportLimit} dashboards only`;
  const isExportable = dashCount <= bulkExportLimit;
  const [isExportDone, setIsExportDone] = React.useState(false);
  let [failedExport, setFailedExport] = React.useState(['']);
  let i = 0;

  let text = t('bmc.search.comfirm-export', 'Do you want to export the {{dashCount}} selected dashboard(s)?', {
    dashCount,
  });

  const exportDashboards = () => {
    setIsDownloading(true);
    _exportDashboards({
      dashUids: dashboards,
    })
      .then((result) => {
        if (result != null) {
          setFailedExport(result);
          setIsExportDone(true);
        } else {
          setFailedExport([]);
          setIsExportDone(true);
        }
      })
      .finally(() => {
        setIsDownloading(false);
      });
  };

  return isOpen ? (
    !isExportDone ? (
      <Modal className={styles.modal} title={t('bmc.search.export', 'Export')} isOpen={isOpen} onDismiss={onDismiss}>
        {isExportable ? (
          <>
            <div className={styles.content}>{text}</div>

            <HorizontalGroup justify="center">
              <Button
                icon={isDownloading ? 'fa fa-spinner' : undefined}
                disabled={isDownloading}
                variant="primary"
                onClick={exportDashboards}
              >
                <Trans i18nKey="bmc.search.export">Export</Trans>
              </Button>
              <Button variant="secondary" onClick={onDismiss}>
                <Trans i18nKey="bmc.common.cancel">Cancel</Trans>
              </Button>
            </HorizontalGroup>
          </>
        ) : (
          <div className={styles.content}>{bulkExportLimitMsg}</div>
        )}
      </Modal>
    ) : (
      <div className={styles.disableOutsideClicks}>
        <Modal
          className={styles.modalExportStatus}
          title={t('bmc.search.export-status', 'Export Status')}
          isOpen={isExportDone}
          onDismiss={() => {
            onExportDone();
            onDismiss();
          }}
        >
          <>
            <div className={styles.contentExportStatus}>
              {/* BMC change */}
              <Trans i18nKey="bmc.export.successful">Export Successfull:</Trans> <span className={styles.exportSuccess}>{dashCount - failedExport.length}</span>
            </div>
            <div className={styles.contentExportStatus}>
              {/* BMC change */}
              <Trans i18nKey="bmc.export.fail">Export Failed:</Trans> <span className={styles.exportFailed}>{failedExport.length}</span>
            </div>
            {failedExport.length === 0 ? null : (
              <CollapsableSection label="Failed Dashboards" isOpen={false} className={styles.collapseExport}>
                {failedExport.map(function (each: string) {
                  i++;
                  return (
                    <p key={each}>
                      {i}. {each}
                    </p>
                  );
                })}
              </CollapsableSection>
            )}
          </>
        </Modal>
      </div>
    )
  ) : null;
};

const getStyles = stylesFactory((theme: GrafanaTheme, theme2: GrafanaTheme2) => {
  return {
    modal: css`
      width: 500px;
    `,
    content: css`
      margin-bottom: ${theme.spacing.lg};
      font-size: 16px;
    `,
    contentExportStatus: css`
      margin-bottom: 20px;
      font-size: 15px;
    `,
    modalExportStatus: css`
      width: 500px;
      z-index: 10000;
    `,
    disableOutsideClicks: css`
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      left: 0;
      z-index: 10000;
    `,
    collapseExport: css`
      font-size: 15px;
      padding: 0px;
    `,
    exportSuccess: css`
      color: ${theme2.colors.success.main};
    `,
    exportFailed: css`
      color: ${theme2.colors.error.main};
    `,
  };
});
