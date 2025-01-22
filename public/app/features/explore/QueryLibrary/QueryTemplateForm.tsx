import { useForm } from 'react-hook-form';
import { useAsync } from 'react-use';

import { AppEvents, dateTime } from '@grafana/data';
import { DataSourcePicker, getAppEvents, getDataSourceSrv } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { Button, InlineSwitch, Modal, RadioButtonGroup, TextArea } from '@grafana/ui';
import { Field } from '@grafana/ui/';
import { Input } from '@grafana/ui/src/components/Input/Input';
import { Trans, t } from 'app/core/internationalization';
import { getQueryDisplayText } from 'app/core/utils/richHistory';
import { useCreateQueryTemplateMutation, useUpdateQueryTemplateMutation } from 'app/features/query-library';
import { AddQueryTemplateCommand, EditQueryTemplateCommand } from 'app/features/query-library/types';

import { convertAddQueryTemplateCommandToDataQuerySpec } from '../../query-library/api/mappers';
import { useDatasource } from '../QueryLibrary/utils/useDatasource';

import { QueryTemplateRow } from './QueryTemplatesTable/types';

type Props = {
  onCancel: () => void;
  onSave: (isSuccess: boolean) => void;
  queryToAdd?: DataQuery;
  templateData?: QueryTemplateRow;
};

export type QueryDetails = {
  description: string;
};

const VisibilityOptions = [
  { value: 'Public', label: t('explore.query-library.public', 'Public') },
  { value: 'Private', label: t('explore.query-library.private', 'Private') },
];

const getInstuctions = (isAdd: boolean) => {
  return isAdd
    ? t(
        'explore.query-template-modal.add-info',
        `You're about to save this query. Once saved, you can easily access it in the Query Library tab for future use and reference.`
      )
    : t(
        'explore.query-template-modal.edit-info',
        `You're about to edit this query. Once saved, you can easily access it in the Query Library tab for future use and reference.`
      );
};

export const QueryTemplateForm = ({ onCancel, onSave, queryToAdd, templateData }: Props) => {
  const { register, handleSubmit } = useForm<QueryDetails>({
    defaultValues: {
      description: templateData?.description,
    },
  });

  const [addQueryTemplate] = useCreateQueryTemplateMutation();
  const [editQueryTemplate] = useUpdateQueryTemplateMutation();

  const datasource = useDatasource(queryToAdd?.datasource);

  // this is an array to support multi query templates sometime in the future
  const queries =
    queryToAdd !== undefined ? [queryToAdd] : templateData?.query !== undefined ? [templateData?.query] : [];

  const handleAddQueryTemplate = async (addQueryTemplateCommand: AddQueryTemplateCommand) => {
    return addQueryTemplate({
      queryTemplate: convertAddQueryTemplateCommandToDataQuerySpec(addQueryTemplateCommand),
    })
      .unwrap()
      .then(() => {
        getAppEvents().publish({
          type: AppEvents.alertSuccess.name,
          payload: [t('explore.query-library.query-template-added', 'Query successfully saved to the library')],
        });
        return true;
      })
      .catch(() => {
        getAppEvents().publish({
          type: AppEvents.alertError.name,
          payload: [
            t('explore.query-library.query-template-add-error', 'Error attempting to save this query to the library'),
          ],
        });
        return false;
      });
  };

  const handleEditQueryTemplate = async (editQueryTemplateCommand: EditQueryTemplateCommand) => {
    return editQueryTemplate({
      name: editQueryTemplateCommand.uid,
      patch: {
        spec: editQueryTemplateCommand.partialSpec,
      },
    })
      .unwrap()
      .then(() => {
        getAppEvents().publish({
          type: AppEvents.alertSuccess.name,
          payload: [t('explore.query-library.query-template-edited', 'Query template successfully edited')],
        });
        return true;
      })
      .catch(() => {
        getAppEvents().publish({
          type: AppEvents.alertError.name,
          payload: [t('explore.query-library.query-template-edit-error', 'Error attempting to edit this query')],
        });
        return false;
      });
  };

  const onSubmit = async (data: QueryDetails) => {
    const timestamp = dateTime().toISOString();
    const temporaryDefaultTitle =
      data.description || t('explore.query-library.default-description', 'Public', { timestamp: timestamp });

    if (templateData?.uid) {
      handleEditQueryTemplate({ uid: templateData.uid, partialSpec: { title: data.description } }).then((isSuccess) => {
        onSave(isSuccess);
      });
    } else if (queryToAdd) {
      handleAddQueryTemplate({ title: temporaryDefaultTitle, targets: [queryToAdd] }).then((isSuccess) => {
        onSave(isSuccess);
      });
    }
  };

  const { value: queryText } = useAsync(async () => {
    const promises = queries.map(async (query, i) => {
      const datasource = await getDataSourceSrv().get(query.datasource);
      return datasource?.getQueryDisplayText?.(query) || getQueryDisplayText(query);
    });
    return Promise.all(promises);
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <p>{getInstuctions(templateData === undefined)}</p>
      {queryText &&
        queryText.map((queryString, i) => (
          <Field key={`query-${i}`} label={t('explore.query-template-modal.query', 'Query')}>
            <TextArea readOnly={true} value={queryString}></TextArea>
          </Field>
        ))}
      {queryToAdd && (
        <>
          <Field label={t('explore.query-template-modal.data-source-name', 'Data source name')}>
            <DataSourcePicker current={datasource?.uid} disabled={true} />
          </Field>
          <Field label={t('explore.query-template-modall.data-source-type', 'Data source type')}>
            <Input disabled={true} defaultValue={datasource?.meta.name}></Input>
          </Field>
        </>
      )}
      <Field label={t('explore.query-template-modal.description', 'Description')}>
        <Input id="query-template-description" autoFocus={true} {...register('description')}></Input>
      </Field>
      <Field label={t('explore.query-template-modal.visibility', 'Visibility')}>
        <RadioButtonGroup options={VisibilityOptions} value={'Public'} disabled={true} />
      </Field>
      <InlineSwitch
        showLabel={true}
        disabled={true}
        label={t(
          'explore.query-template-modal.auto-star',
          'Auto-star this query to add it to your starred list in the Query Library.'
        )}
      />
      <Modal.ButtonRow>
        <Button variant="secondary" onClick={() => onCancel()} fill="outline">
          <Trans i18nKey="explore.query-library.cancel">Cancel</Trans>
        </Button>
        <Button variant="primary" type="submit">
          <Trans i18nKey="explore.query-library.save">Save</Trans>
        </Button>
      </Modal.ButtonRow>
    </form>
  );
};
