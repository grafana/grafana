import { css } from '@emotion/css';
import React, { useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { Button, Field, Modal, MultiSelect, TextArea, useStyles2 } from '@grafana/ui';

import { useCreateDashboardPreviewQuery, useGetChannelsQuery } from '../../../api/shareToSlackApi';

export function ShareSlackModal({
  dashboardUid,
  dashboardUrl,
  onDismiss,
}: {
  dashboardUid: string;
  dashboardUrl: string;
  onDismiss(): void;
}) {
  const [value, setValue] = useState<Array<SelectableValue<string>>>();
  const { data: channels, isLoading: isChannelsLoading, isFetching: isChannelsFetching } = useGetChannelsQuery();
  const {
    data: preview,
    isLoading: isPreviewLoading,
    refetch,
    isFetching: isPreviewFetching,
  } = useCreateDashboardPreviewQuery({ dashboardUid, dashboardUrl }, { refetchOnMountOrArgChange: false });

  const styles = useStyles2(getStyles);

  const disableShareButton = isChannelsLoading || isChannelsFetching || isPreviewLoading || isPreviewFetching;

  return (
    <Modal className={styles.modal} isOpen title="Share to Slack" onDismiss={onDismiss}>
      <div>
        <Field label="Select channel">
          <MultiSelect
            isLoading={isChannelsLoading || isChannelsFetching}
            placeholder="Select channel"
            options={channels}
            value={value}
            onChange={(v) => {
              setValue(v);
            }}
          />
        </Field>
        <Field label="Description">
          <TextArea placeholder="Type your message" cols={2} />
        </Field>
        <Field label="Dashboard preview" horizontal className={styles.refreshContainer}>
          {preview ? (
            <Button size="sm" icon="sync" variant="primary" fill="text" onClick={refetch}>
              Refresh
            </Button>
          ) : (
            <></>
          )}
        </Field>
        {isPreviewLoading || isPreviewFetching ? (
          <img
            className={styles.dashboardPreview}
            alt="dashboard-preview-placeholder"
            src="public/img/share/dashboard_preview_placeholder.png"
          />
        ) : (
          <>
            <img className={styles.dashboardPreview} alt="dashboard-preview" src={preview?.previewUrl} />
          </>
        )}
      </div>
      <Modal.ButtonRow>
        <Button variant="secondary" fill="outline" onClick={onDismiss}>
          Cancel
        </Button>
        <Button disabled={!value || disableShareButton}>Share</Button>
      </Modal.ButtonRow>
    </Modal>
  );
}

const getStyles = () => ({
  modal: css({
    width: '500px',
  }),
  refreshContainer: css({
    alignItems: 'center',
  }),
  dashboardPreview: css({
    width: '100%',
  }),
});
