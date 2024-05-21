import { t } from 'i18next';
import React from 'react';

import { AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { Button } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
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

  return isQueryLibraryEnabled() && !isSuccess ? (
    <Button
      variant="secondary"
      onClick={() => {
        handleAddQueryTemplate({ title: 'Test', targets: [query] });
      }}
    >
      <Trans i18nKey="explore.rich-history-card.add-to-library">Add to library</Trans>
    </Button>
  ) : undefined;
};
