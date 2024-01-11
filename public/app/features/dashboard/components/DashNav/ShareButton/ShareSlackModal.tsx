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
  const [value, setValue] = useState<Array<SelectableValue<string>>>([]);
  const { data: channels, isLoading, isFetching } = useGetChannelsQuery();
  const { data: preview, isLoading: isPreviewLoading } = useCreateDashboardPreviewQuery({ dashboardUid, dashboardUrl });

  const styles = useStyles2(getStyles);

  return (
    <Modal className={styles.modal} isOpen title="Share to slack" onDismiss={onDismiss}>
      <div>
        <Field label="Select channel">
          <MultiSelect
            isLoading={isLoading || isFetching}
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
        <Field label="Dashboard preview">
          {isPreviewLoading ? (
            <img
              className={styles.dashboardPreview}
              alt="dashboard-preview-placeholder"
              src="public/img/share/dashboard_preview_placeholder.png"
            />
          ) : (
            <img className={styles.dashboardPreview} alt="dashboard-preview" src={preview?.previewUrl} />
          )}
        </Field>
      </div>
      <Modal.ButtonRow>
        <Button variant="secondary" fill="outline">
          Cancel
        </Button>
        <Button disabled={!value}>Share</Button>
      </Modal.ButtonRow>
    </Modal>
  );
}

const getStyles = () => ({
  modal: css({
    width: '500px',
  }),
  dashboardPreview: css({
    width: '100%',
  }),
});
