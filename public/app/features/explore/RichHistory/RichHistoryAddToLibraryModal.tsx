import React from 'react';

import { DataSourcePicker } from '@grafana/runtime';
import { Button, InlineSwitch, Input, Modal, RadioButtonGroup, TextArea } from '@grafana/ui';
import { Field } from '@grafana/ui/';
import { t } from 'app/core/internationalization';

type Props = {
  onCancel: () => void;
  onSave: () => void;
};

export const RichHistoryAddToLibraryModal = ({ onCancel, onSave }: Props) => {
  const visibilityOptions = [
    { value: 'Public', label: 'Public' },
    { value: 'Private', label: 'Private' },
  ];
  return (
    <div>
      <p>
        You are about to save this query. Once saved, you can easily access it in the Query Library under the Saved
        Queries tab for future use and reference.
      </p>
      <Field label={t('explore.add-to-library-modal.query', 'Query')}>
        <TextArea readOnly={true}>
          {`SELECT ANY_VALUE(date_stamp) FROM chris-analytics-testing.dbt_cshih.agg_trips_by_station_daily LIMIT 50`}
        </TextArea>
      </Field>
      <Field label={t('explore.add-to-library-modal.data-source-name', 'Data source name')}>
        <DataSourcePicker current="default" disabled={true} />
      </Field>
      <Field label={t('explore.add-to-library-modal.data-source-type', 'Data source type')}>
        <Input disabled={true} value="BigQuery"></Input>
      </Field>
      <Field label={t('explore.add-to-library-modal.description', 'Description')}>
        <Input></Input>
      </Field>
      <Field label={t('explore.add-to-library-modal.visibility', 'Visibility')}>
        <RadioButtonGroup options={visibilityOptions} value={'Public'} disabled={true} />
      </Field>
      <InlineSwitch
        showLabel={true}
        label={t(
          'explore.add-to-library-modal.auto-star',
          'Auto-star this query to add it to your starred list in the Query Library.'
        )}
      />
      <Modal.ButtonRow>
        <Button variant="secondary" onClick={onCancel} fill="outline">
          Cancel
        </Button>
        <Button variant="primary" onClick={() => onSave()}>
          Save
        </Button>
      </Modal.ButtonRow>
    </div>
  );
};
