import { t } from 'i18next';
import React from 'react';

import { AppEvents, dateTime } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { Button } from '@grafana/ui';
import { isQueryLibraryEnabled, useAddQueryTemplateMutation } from 'app/features/query-library';
import { AddQueryTemplateCommand } from 'app/features/query-library/types';

type Props = {
  query: DataQuery;
};

export const RichHistoryAddToLibrary = ({ query }: Props) => {
  const [addQueryTemplate, { isSuccess }] = useAddQueryTemplateMutation();

  const handleAddQueryTemplate = async (addQueryTemplateCommand: AddQueryTemplateCommand) => {
    const result = await addQueryTemplate(addQueryTemplateCommand);
    if (!result.error) {
      getAppEvents().publish({
        type: AppEvents.alertSuccess.name,
        payload: [
          t('explore.rich-history-card.query-template-added', 'Query template successfully added to the library'),
        ],
      });
    }
  };

  const buttonLabel = t('explore.rich-history-card.add-to-library', 'Add to library');

  return isQueryLibraryEnabled() && !isSuccess ? (
    <Button
      variant="secondary"
      aria-label={buttonLabel}
      onClick={() => {
        const timestamp = dateTime().toISOString();
        const temporaryDefaultTitle = `Imported from Explore - ${timestamp}`;
        handleAddQueryTemplate({ title: temporaryDefaultTitle, targets: [query] });
      }}
    >
      {buttonLabel}
    </Button>
  ) : undefined;
};
