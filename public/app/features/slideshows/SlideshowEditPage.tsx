import { useState } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import {
  type Slideshow,
  useCreateSlideshowMutation,
  useGetSlideshowQuery,
  useReplaceSlideshowMutation,
} from '@grafana/api-clients/rtkq/collections/v1alpha1';
import { type NavModelItem } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Alert } from '@grafana/ui';
import { extractErrorMessage } from 'app/api/utils';
import { Page } from 'app/core/components/Page/Page';

import { SlideshowForm } from './SlideshowForm';

const newSlideshow = (): Slideshow => ({
  apiVersion: 'collections.grafana.app/v1alpha1',
  kind: 'Slideshow',
  metadata: { generateName: 's-' },
  spec: { title: '', interval: '5m', items: [] },
});

/** Creates a slideshow, or edits the one named in the route. */
export default function SlideshowEditPage() {
  const { uid } = useParams();
  const isNew = !uid;
  const { data, isLoading, isError, error } = useGetSlideshowQuery({ name: uid ?? '' }, { skip: isNew });
  const [create] = useCreateSlideshowMutation();
  const [replace] = useReplaceSlideshowMutation();

  const [saveError, setSaveError] = useState<string | undefined>();

  const onSubmit = async (slideshow: Slideshow) => {
    setSaveError(undefined);
    const result = uid ? await replace({ name: uid, slideshow }) : await create({ slideshow });
    if (result.error) {
      // The form keeps what the user typed, so they can retry once the cause is fixed.
      setSaveError(extractErrorMessage(result.error, t('slideshows.edit.save-error', 'Could not save the slideshow')));
      return;
    }
    locationService.push('/slideshows');
  };

  const pageNav: NavModelItem = {
    text: isNew ? t('slideshows.edit.new-title', 'New slideshow') : t('slideshows.edit.edit-title', 'Edit slideshow'),
  };

  return (
    <Page navId="slideshows" pageNav={pageNav}>
      <Page.Contents isLoading={!isNew && isLoading}>
        {isError && (
          <div>
            <Trans i18nKey="slideshows.edit.load-error">Error loading slideshow:</Trans> {JSON.stringify(error)}
          </div>
        )}
        {saveError && (
          <Alert severity="error" title={t('slideshows.edit.save-error-title', 'Save failed')}>
            {saveError}
          </Alert>
        )}
        {isNew && <SlideshowForm slideshow={newSlideshow()} onSubmit={onSubmit} />}
        {data && <SlideshowForm slideshow={data} onSubmit={onSubmit} />}
      </Page.Contents>
    </Page>
  );
}
