import { useMemo } from 'react';
import { useForm } from 'react-hook-form';

import { DataSourcePicker } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { Button, InlineSwitch, Modal, RadioButtonGroup, TextArea } from '@grafana/ui';
import { Field } from '@grafana/ui/';
import { Input } from '@grafana/ui/src/components/Input/Input';
import { t } from 'app/core/internationalization';

import { getQueryDisplayText } from '../../../core/utils/richHistory';
import { useDatasource } from '../QueryLibrary/utils/useDatasource';

type Props = {
  onCancel: () => void;
  onSave: (details: QueryDetails) => void;
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

export const RichHistoryAddToLibraryForm = ({ onCancel, onSave, query }: Props) => {
  const { register, handleSubmit } = useForm<QueryDetails>();

  const datasource = useDatasource(query.datasource);

  const displayText = useMemo(() => {
    return datasource?.getQueryDisplayText?.(query) || getQueryDisplayText(query);
  }, [datasource, query]);

  const onSubmit = (data: QueryDetails) => {
    onSave(data);
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
