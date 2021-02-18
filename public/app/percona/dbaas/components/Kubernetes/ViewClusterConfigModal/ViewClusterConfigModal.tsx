import React, { FC, useCallback, useEffect, useRef, useState } from 'react';
import { Button, ClipboardButton, HorizontalGroup, useTheme } from '@grafana/ui';
import { AppEvents } from '@grafana/data';
import { appEvents } from 'app/core/app_events';
import { Modal, logger } from '@percona/platform-core';
import { Overlay } from 'app/percona/shared/components/Elements/Overlay/Overlay';
import { ViewKubernetesClusterModalProps } from './ViewClusterConfigModal.types';
import { KubernetesService } from '../Kubernetes.service';
import { Messages } from '../../../DBaaS.messages';
import { getStyles } from './ViewClusterConfigModal.styles';

export const ViewClusterConfigModal: FC<ViewKubernetesClusterModalProps> = ({
  isVisible,
  setVisible,
  selectedCluster,
}) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  const [kubeconfig, setKubeconfig] = useState('');
  const [loading, setLoading] = useState(false);
  const outputRef = useRef<HTMLPreElement>(null);

  const copyToClipboard = useCallback(() => {
    appEvents.emit(AppEvents.alertSuccess, [Messages.successfulCopyMessage]);

    return outputRef.current?.textContent || '';
  }, [outputRef]);

  useEffect(() => {
    const getClusters = async () => {
      if (!selectedCluster?.kubernetesClusterName) {
        setVisible(false);

        return;
      }

      setLoading(true);
      try {
        const config = await KubernetesService.getKubernetesConfig(selectedCluster);

        setKubeconfig(config.kube_auth.kubeconfig);
      } catch (e) {
        logger.error(e);
      } finally {
        setLoading(false);
      }
    };

    getClusters();
  }, [selectedCluster]);

  return (
    <Modal title="View cluster config" isVisible={isVisible} onClose={() => setVisible(false)}>
      <HorizontalGroup justify="flex-start" spacing="md">
        <ClipboardButton getText={copyToClipboard} variant="secondary" size="sm">
          {Messages.copyToClipboard}
        </ClipboardButton>
      </HorizontalGroup>
      <Overlay isPending={loading} className={styles.overlay}>
        <pre ref={outputRef}>{kubeconfig}</pre>
      </Overlay>
      <HorizontalGroup justify="flex-end" spacing="md">
        <Button variant="destructive" size="md" onClick={() => setVisible(false)} data-qa="delete-dbcluster-button">
          Close
        </Button>
      </HorizontalGroup>
    </Modal>
  );
};
