import React, { useMemo } from 'react';
import { useForm } from 'react-hook-form';

import { AppEvents, dateTime } from '@grafana/data';
import { DataSourcePicker, getAppEvents } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { Button, InlineSwitch, Modal, RadioButtonGroup, TextArea } from '@grafana/ui';
import { Field } from '@grafana/ui/';
import { Input } from '@grafana/ui/src/components/Input/Input';
import { t } from 'app/core/internationalization';
import { getQueryDisplayText } from 'app/core/utils/richHistory';
import { useAddQueryTemplateMutation } from 'app/features/query-library';
import { AddQueryTemplateCommand } from 'app/features/query-library/types';

import { useDatasource } from '../QueryLibrary/utils/useDatasource';

type Props = {
  onCancel: () => void;
  onSave: (isSuccess: boolean) => void;
  query: DataQuery;
};

export type QueryDetails = {
  description: string;
};

const VisibilityOptions = [
  { value: 'Public', label: 'Public' },
  { value: 'Private', label: 'Private' },
];

const info = t(
  'explore.add-to-library-modal.info',
  `You're about to save this query. Once saved, you can easily access it in the Query Library tab for future use and reference.`
);

export const AddToLibraryForm = ({ onCancel, onSave, query }: Props) => {
  const { register, handleSubmit } = useForm<QueryDetails>();

  const [addQueryTemplate] = useAddQueryTemplateMutation();

  const handleAddQueryTemplate = async (addQueryTemplateCommand: AddQueryTemplateCommand) => {
    return addQueryTemplate(addQueryTemplateCommand)
      .unwrap()
      .then(() => {
        getAppEvents().publish({
          type: AppEvents.alertSuccess.name,
          payload: [
            t('explore.rich-history-card.query-template-added', 'Query template successfully added to the library'),
          ],
        });
        return true;
      })
      .catch(() => {
        getAppEvents().publish({
          type: AppEvents.alertError.name,
          payload: [
            t('explore.rich-history-card.query-template-error', 'Error attempting to add this query to the library'),
          ],
        });
        return false;
      });
  };

  const datasource = useDatasource(query.datasource);

  const displayText = useMemo(() => {
    return datasource?.getQueryDisplayText?.(query) || getQueryDisplayText(query);
  }, [datasource, query]);

  const onSubmit = async (data: QueryDetails) => {
    const timestamp = dateTime().toISOString();
    const temporaryDefaultTitle = data.description || `Imported from Explore - ${timestamp}`;
    handleAddQueryTemplate({ title: temporaryDefaultTitle, targets: [query] }).then((isSuccess) => {
      onSave(isSuccess);
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <p>{info}</p>
      <Field label={t('explore.add-to-library-modal.query', 'Query')}>
        <TextArea readOnly={true} value={displayText}></TextArea>
      </Field>
      <Field label={t('explore.add-to-library-modal.data-source-name', 'Data source name')}>
        <DataSourcePicker current={datasource?.uid} disabled={true} />
      </Field>
      <Field label={t('explore.add-to-library-modal.data-source-type', 'Data source type')}>
        <Input disabled={true} defaultValue={datasource?.meta.name}></Input>
      </Field>
      <Field label={t('explore.add-to-library-modal.description', 'Description')}>
        <Input id="query-template-description" autoFocus={true} {...register('description')}></Input>
      </Field>
      <Field label={t('explore.add-to-library-modal.visibility', 'Visibility')}>
        <RadioButtonGroup options={VisibilityOptions} value={'Public'} disabled={true} />
      </Field>
      <InlineSwitch
        showLabel={true}
        disabled={true}
        label={t(
          'explore.add-to-library-modal.auto-star',
          'Auto-star this query to add it to your starred list in the Query Library.'
        )}
      />
      <Modal.ButtonRow>
        <Button variant="secondary" onClick={() => onCancel()} fill="outline">
          Cancel
        </Button>
        <Button variant="primary" type="submit">
          Save
        </Button>
      </Modal.ButtonRow>
    </form>
  );
};
