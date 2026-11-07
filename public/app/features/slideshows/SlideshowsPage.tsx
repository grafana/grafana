import { useState } from 'react';

import {
  type Slideshow,
  useDeleteSlideshowMutation,
  useListSlideshowQuery,
} from '@grafana/api-clients/rtkq/collections/v1alpha1';
import { locationUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Button, Card, ConfirmModal, EmptyState, LinkButton, Stack } from '@grafana/ui';
import { extractErrorMessage } from 'app/api/utils';
import { Page } from 'app/core/components/Page/Page';

import { StartModal } from '../playlist/StartModal';
import { useCanWritePlaylists } from '../playlist/utils';

export default function SlideshowsPage() {
  const canWrite = useCanWritePlaylists();
  const { data, isLoading } = useListSlideshowQuery({});
  const [deleteSlideshow] = useDeleteSlideshowMutation();
  const [toStart, setToStart] = useState<Slideshow | undefined>();
  const [toDelete, setToDelete] = useState<Slideshow | undefined>();
  const slideshows = data?.items ?? [];

  const [deleteError, setDeleteError] = useState<string | undefined>();

  const onDelete = async () => {
    if (!toDelete) {
      return;
    }
    setDeleteError(undefined);
    const result = await deleteSlideshow({ name: toDelete.metadata.name ?? '' });
    if (result.error) {
      setDeleteError(
        extractErrorMessage(result.error, t('slideshows.page.delete-error', 'Could not delete the slideshow'))
      );
    }
    setToDelete(undefined);
  };

  return (
    <Page
      navId="slideshows"
      pageNav={{ text: t('slideshows.page.title', 'Slideshows') }}
      actions={
        canWrite ? (
          <LinkButton href={locationUtil.assureBaseUrl('/slideshows/new')}>
            <Trans i18nKey="slideshows.page.new">New slideshow</Trans>
          </LinkButton>
        ) : undefined
      }
    >
      <Page.Contents isLoading={isLoading}>
        {deleteError && (
          <Alert severity="error" title={t('slideshows.page.delete-error-title', 'Delete failed')}>
            {deleteError}
          </Alert>
        )}
        {slideshows.length === 0 && !isLoading && (
          <EmptyState variant="completed" message={t('slideshows.page.empty', 'There are no slideshows yet')} />
        )}
        <Stack direction="column" gap={1} role="list">
          {slideshows.map((slideshow) => (
            <div key={slideshow.metadata.name} role="listitem">
              <Card noMargin>
                <Card.Heading>{slideshow.spec.title}</Card.Heading>
                <Card.Actions>
                  <Button
                    variant="secondary"
                    icon="play"
                    size="sm"
                    aria-label={t('slideshows.page.start-label', 'Start slideshow {{ name }}', {
                      name: slideshow.spec.title,
                    })}
                    onClick={() => setToStart(slideshow)}
                  >
                    <Trans i18nKey="slideshows.page.start">Start</Trans>
                  </Button>
                  {canWrite && (
                    <LinkButton
                      variant="secondary"
                      icon="cog"
                      size="sm"
                      href={locationUtil.assureBaseUrl(`/slideshows/edit/${slideshow.metadata.name}`)}
                      aria-label={t('slideshows.page.edit-label', 'Edit slideshow {{ name }}', {
                        name: slideshow.spec.title,
                      })}
                    >
                      <Trans i18nKey="slideshows.page.edit">Edit</Trans>
                    </LinkButton>
                  )}
                  {canWrite && (
                    <Button
                      variant="secondary"
                      icon="trash-alt"
                      size="sm"
                      aria-label={t('slideshows.page.delete-label', 'Delete slideshow {{ name }}', {
                        name: slideshow.spec.title,
                      })}
                      onClick={() => setToDelete(slideshow)}
                    >
                      <Trans i18nKey="slideshows.page.delete">Delete</Trans>
                    </Button>
                  )}
                </Card.Actions>
              </Card>
            </div>
          ))}
        </Stack>
        {toStart && (
          <StartModal
            title={toStart.spec.title}
            startUrl={`/slideshows/play/${toStart.metadata.name}`}
            onDismiss={() => setToStart(undefined)}
          />
        )}
        {toDelete && (
          <ConfirmModal
            isOpen
            title={toDelete.spec.title}
            body={t('slideshows.page.delete-body', 'Are you sure you want to delete {{name}} slideshow?', {
              name: toDelete.spec.title,
            })}
            confirmText={t('slideshows.page.delete-confirm', 'Delete')}
            onConfirm={onDelete}
            onDismiss={() => setToDelete(undefined)}
          />
        )}
      </Page.Contents>
    </Page>
  );
}
