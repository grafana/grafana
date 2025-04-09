import { css, cx } from '@emotion/css';
import { useState, useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { t } from '../../utils/i18n';
import { Alert } from '../Alert/Alert';
import { IconButton } from '../IconButton/IconButton';

// Define the image item interface
export interface CarouselImage {
  path: string;
  name: string;
}

export interface CarouselProps {
  images: CarouselImage[];
}

export const Carousel: React.FC<CarouselProps> = ({ images }) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [validImages, setValidImages] = useState<CarouselImage[]>(images);

  const styles = useStyles2(getStyles());

  const handleImageError = (path: string) => {
    setImageErrors((prev) => ({
      ...prev,
      [path]: true,
    }));
  };

  useEffect(() => {
    const filteredImages = images.filter((image) => !imageErrors[image.path]);
    setValidImages(filteredImages);
  }, [imageErrors, images]);

  const openPreview = (index: number) => {
    setSelectedIndex(index);
  };

  const closePreview = () => {
    setSelectedIndex(null);
  };

  const goToNext = () => {
    if (selectedIndex !== null && validImages.length > 0) {
      setSelectedIndex((selectedIndex + 1) % validImages.length);
    }
  };

  const goToPrevious = () => {
    if (selectedIndex !== null && validImages.length > 0) {
      setSelectedIndex((selectedIndex - 1 + validImages.length) % validImages.length);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (selectedIndex === null) {
      return;
    }

    switch (event.key) {
      case 'ArrowRight':
        goToNext();
        break;
      case 'ArrowLeft':
        goToPrevious();
        break;
      case 'Escape':
        closePreview();
        break;
      default:
        break;
    }
  };

  if (validImages.length === 0) {
    return (
      <Alert
        title={t('carousel.error', 'Something went wrong loading images')}
        severity="warning"
        data-testid="alert-warning"
      />
    );
  }

  return (
    <div onKeyDown={handleKeyDown} tabIndex={0}>
      <div className={cx(styles.imageGrid)}>
        {validImages.map((image, index) => (
          <div key={image.path} onClick={() => openPreview(index)} style={{ cursor: 'pointer' }}>
            <img src={image.path} alt={image.name} onError={() => handleImageError(image.path)} />
            <p>{image.name}</p>
          </div>
        ))}
      </div>

      {selectedIndex !== null && (
        <div className={cx(styles.fullScreenDiv)} onClick={closePreview} data-testid="carousel-full-screen">
          <IconButton
            name="times"
            aria-label={t('carousel.close', 'Close')}
            size="xl"
            onClick={closePreview}
            className={cx(styles.closeButton)}
          />

          <IconButton
            size="xl"
            name="angle-left"
            aria-label={t('carousel.previous', 'Previous')}
            onClick={(e) => {
              e.stopPropagation();
              goToPrevious();
            }}
            className={cx(styles.navigationButton, styles.previousButton)}
            data-testid="previous-button"
          />

          <div
            style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%' }}
            onClick={(e) => e.stopPropagation()}
            data-testid="carousel-full-image"
          >
            <img
              src={validImages[selectedIndex].path}
              alt={validImages[selectedIndex].name}
              onError={() => handleImageError(validImages[selectedIndex].path)}
            />
          </div>

          <IconButton
            size="xl"
            name="angle-right"
            aria-label={t('carousel.next', 'Next')}
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
            className={cx(styles.navigationButton, styles.nextButton)}
            data-testid="next-button"
          />
        </div>
      )}
    </div>
  );
};

const getStyles = () => (theme: GrafanaTheme2) => ({
  imageGrid: css({
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fill, minmax(200px, 1fr))`,
    gap: '16px',
    marginBottom: '20px',

    '& img': {
      width: '100%',
      height: '150px',
      objectFit: 'cover',
      border: theme.colors.border.strong,
      borderRadius: theme.shape.radius.default,
      boxShadow: theme.shadows.z1,
    },
    '& p': {
      margin: '4px 0',
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.primary,
    },
  }),
  fullScreenDiv: css({
    position: 'fixed',
    zIndex: theme.zIndex.modalBackdrop,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: theme.components.overlay.background,
    alignItems: 'center',
    justifyContent: 'center',
    display: 'flex',

    '& img': {
      maxWidth: '100%',
      maxHeight: '80vh',
      objectFit: 'contain',
    },
  }),
  closeButton: css({
    position: 'absolute',
    top: '20px',
    right: '20px',
    backgroundColor: 'transparent',
    color: theme.colors.text.primary,
  }),
  navigationButton: css({
    position: 'absolute',
    backgroundColor: 'transparent',
    color: theme.colors.text.primary,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),
  nextButton: css({
    right: '20px',
  }),
  previousButton: css({
    left: '20px',
  }),
});
