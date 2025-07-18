import { css } from '@emotion/css';
import { useMemo, useEffect } from 'react';
import { useMeasure } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, LoadingBar, Text, useStyles2 } from '@grafana/ui';

type ErrorState = {
  message: string;
  title: string;
} | null;

interface ImagePreviewProps {
  imageBlob: Blob | null;
  isLoading: boolean;
  error: ErrorState;
  title?: string;
}

export function ImagePreview({ imageBlob, isLoading, error, title }: ImagePreviewProps) {
  const styles = useStyles2(getStyles);
  const [ref, { width: measuredWidth }] = useMeasure<HTMLDivElement>();

  // Memoize and clean up the object URL for the image
  const imageUrl = useMemo(() => {
    if (!imageBlob) {
      return undefined;
    }
    const url = URL.createObjectURL(imageBlob);
    return url;
  }, [imageBlob]);

  useEffect(() => {
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl]);

  return (
    <div
      className={styles.previewContainer}
      ref={ref}
      aria-label={t('share-modal.image.preview-region', 'Image preview')}
      role="region"
    >
      {isLoading && (
        <div
          className={styles.loadingBarContainer}
          role="status"
          aria-label={t('share-modal.image.generating', 'Generating image...')}
        >
          <LoadingBar width={measuredWidth} />
          {title && (
            <div className={styles.titleContainer}>
              <Text variant="body">{title}</Text>
            </div>
          )}
        </div>
      )}

      {error && !isLoading && <ErrorAlert error={error} />}
      {!isLoading && imageUrl && (
        <img
          src={imageUrl}
          alt={t('share-modal.image.preview', 'Preview')}
          className={styles.image}
          aria-label={t('share-modal.image.preview-aria', 'Generated image preview')}
        />
      )}
    </div>
  );
}

function ErrorAlert({ error }: { error: ErrorState }) {
  if (!error) {
    return null;
  }

  // Only show message if it's different from the title to avoid repetition
  const showMessage = error.message && error.message !== error.title;

  return (
    <Alert severity="error" title={error.title}>
      {showMessage && <div>{error.message}</div>}
    </Alert>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  previewContainer: css({
    position: 'relative',
    width: '100%',
    minHeight: '200px',
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
    overflow: 'hidden',
  }),
  loadingBarContainer: css({
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  }),
  titleContainer: css({
    padding: theme.spacing(1),
  }),
  image: css({
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
  }),
});
