import React, { useState } from 'react';
import { css } from '@emotion/css';

import { DataQueryError, DataFrame, GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { VizPanel } from '@grafana/scenes';
import { Alert, Button, Drawer, Stack, useStyles2 } from '@grafana/ui';

interface PanelErrorNoticeProps {
  panel: VizPanel;
  error?: DataQueryError;
  onRetry: () => void;
  frames: DataFrame[];
}

export const PanelErrorNotice = ({ panel, error, onRetry, frames }: PanelErrorNoticeProps) => {
  const [showDetails, setShowDetails] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const styles = useStyles2(getStyles);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await onRetry();
      // Give some time for the query to start before resetting
      setTimeout(() => setIsRetrying(false), 1000);
    } catch (err) {
      setIsRetrying(false);
    }
  };

  // Extract error messages from frames or use the main error
  const errorMessages = [];
  
  if (error) {
    errorMessages.push({
      message: error.message || 'Query failed',
      refId: error.refId || '',
    });
  }

  // Also check for errors in frame notices
  frames.forEach((frame: any) => {
    frame.meta?.notices?.forEach((notice: any) => {
      if (notice.severity === 'error') {
        errorMessages.push({
          message: notice.text,
          refId: frame.refId || '',
        });
      }
    });
  });

  if (errorMessages.length === 0) {
    return null;
  }

  const firstError = errorMessages[0];
  const hasMultipleErrors = errorMessages.length > 1;

  return (
    <>
      <div className={styles.errorNotice}>
        <Alert 
          title={t('dashboard-scene.panel-error-notice.title', 'Panel Error')} 
          severity="error"
          elevated={false}
        >
          <Stack direction="column" gap={1}>
            <div className={styles.errorMessage}>
              {firstError.message}
              {hasMultipleErrors && (
                <span className={styles.moreErrors}>
                  {t('dashboard-scene.panel-error-notice.more-errors', ' (+{{count}} more)', { 
                    count: errorMessages.length - 1 
                  })}
                </span>
              )}
            </div>
            
            <Stack direction="row" gap={1}>
              <Button 
                size="sm" 
                icon="sync"
                onClick={handleRetry}
                variant="primary"
                loading={isRetrying}
                disabled={isRetrying}
              >
                {isRetrying 
                  ? t('dashboard-scene.panel-error-notice.retrying', 'Retrying...') 
                  : t('dashboard-scene.panel-error-notice.retry', 'Retry')
                }
              </Button>
              
              <Button 
                size="sm" 
                variant="secondary"
                onClick={() => setShowDetails(true)}
              >
                {t('dashboard-scene.panel-error-notice.details', 'Details')}
              </Button>
            </Stack>
          </Stack>
        </Alert>
      </div>

      {showDetails && (
        <Drawer
          title={t('dashboard-scene.panel-error-notice.drawer-title', 'Error Details: {{title}}', { 
            title: panel.state.title || 'Panel' 
          })}
          onClose={() => setShowDetails(false)}
          size="md"
        >
          <Stack direction="column" gap={2}>
            {errorMessages.map((errorMsg, index) => (
              <Alert 
                key={index}
                title={errorMsg.refId ? `Query ${errorMsg.refId}` : 'Error'}
                severity="error"
              >
                <div className={styles.errorDetailMessage}>
                  {errorMsg.message}
                </div>
              </Alert>
            ))}
            
            <Stack direction="row" gap={1} justifyContent="flex-start">
              <Button 
                icon="sync"
                onClick={() => {
                  handleRetry();
                  setShowDetails(false);
                }}
                variant="primary"
                loading={isRetrying}
                disabled={isRetrying}
              >
                {isRetrying 
                  ? t('dashboard-scene.panel-error-notice.retrying', 'Retrying...') 
                  : t('dashboard-scene.panel-error-notice.retry', 'Retry')
                }
              </Button>
              
              <Button 
                variant="secondary"
                onClick={() => setShowDetails(false)}
              >
                {t('dashboard-scene.panel-error-notice.close', 'Close')}
              </Button>
            </Stack>
          </Stack>
        </Drawer>
      )}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  errorNotice: css({
    position: 'absolute',
    top: theme.spacing(1),
    left: theme.spacing(1),
    right: theme.spacing(1),
    zIndex: theme.zIndex.modal - 1,
    maxWidth: '500px',
  }),
  errorMessage: css({
    fontSize: theme.typography.bodySmall.fontSize,
    lineHeight: theme.typography.bodySmall.lineHeight,
    wordBreak: 'break-word',
  }),
  moreErrors: css({
    color: theme.colors.text.secondary,
    fontStyle: 'italic',
  }),
  errorDetailMessage: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  }),
});