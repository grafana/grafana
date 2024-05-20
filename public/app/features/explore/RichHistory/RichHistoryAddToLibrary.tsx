import React, { useEffect } from 'react';

import { AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { Button } from '@grafana/ui';

import { Trans } from '../../../core/internationalization';
import { isQueryLibraryEnabled, useAddQueryTemplateMutation } from '../../query-library';

type Props = {
  query: DataQuery;
};

export const RichHistoryAddToLibrary = ({ query }: Props) => {
  const [isAdded, setIsAdded] = React.useState(false);

  const [addQueryTemplate, result] = useAddQueryTemplateMutation();

  useEffect(() => {
    console.log(result);
  }, [result]);

  return isQueryLibraryEnabled() && !isAdded ? (
    <Button
      variant="secondary"
      onClick={() => {
        addQueryTemplate({ title: 'Test', targets: [query] });

        getAppEvents().publish({
          type: AppEvents.alertSuccess.name,
          payload: ['Adding: ' + JSON.stringify(query)],
        });
        setIsAdded(true);
      }}
    >
      <Trans i18nKey="explore.rich-history-card.add-to-library">Add to library</Trans>
    </Button>
  ) : undefined;
};
