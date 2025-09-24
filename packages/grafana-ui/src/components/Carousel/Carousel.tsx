import { css, cx } from '@emotion/css';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { OverlayContainer, useOverlay } from '@react-aria/overlays';
import { useState, useEffect, useRef, useId } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { Alert } from '../Alert/Alert';
import { clearButtonStyles } from '../Button/Button';
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
  const id = useId();

  const styles = useStyles2(getStyles);
  const resetButtonStyles = useStyles2(clearButtonStyles);

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

  const ref = useRef<HTMLDivElement>(null);

  const { overlayProps, underlayProps } = useOverlay({ isOpen: selectedIndex !== null, onClose: closePreview }, ref);
  const { dialogProps } = useDialog({}, ref);

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
    <>
      <div className={cx(styles.imageGrid)}>
        {validImages.map((image, index) => {
          const imageNameId = `${id}-carousel-image-${index}`;
          return (
            <button
              aria-label={t('grafana-ui.carousel.aria-label-open-image', 'Open image preview')}
              aria-describedby={imageNameId}
              type="button"
              key={image.path}
              onClick={() => openPreview(index)}
              className={cx(resetButtonStyles, styles.imageButton)}
            >
              <img src={image.path} alt="" onError={() => handleImageError(image.path)} />
              <p id={imageNameId}>{image.name}</p>
            </button>
          );
        })}
      </div>

      {selectedIndex !== null && (
        <OverlayContainer>
          <div role="presentation" className={styles.underlay} onClick={closePreview} {...underlayProps} />
          <FocusScope contain autoFocus restoreFocus>
            {/* convenience method for keyboard users */}
            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
            <div
              data-testid="carousel-full-screen"
              ref={ref}
              {...overlayProps}
              {...dialogProps}
              onKeyDown={handleKeyDown}
              className={styles.overlay}
            >
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
                onClick={goToPrevious}
                data-testid="previous-button"
              />

              <div className={styles.imageContainer} data-testid="carousel-full-image">
                <img
                  className={styles.imagePreview}
                  src={validImages[selectedIndex].path}
                  alt={validImages[selectedIndex].name}
                  onError={() => handleImageError(validImages[selectedIndex].path)}
                />
              </div>

              <IconButton
                size="xl"
                name="angle-right"
                aria-label={t('carousel.next', 'Next')}
                onClick={goToNext}
                data-testid="next-button"
              />
            </div>
          </FocusScope>
        </OverlayContainer>
      )}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  imageButton: css({
    textAlign: 'left',
  }),
  imageContainer: css({
    display: 'flex',
    justifyContent: 'center',
    flex: 1,
  }),
  imagePreview: css({
    maxWidth: '100%',
    maxHeight: '80vh',
    objectFit: 'contain',
  }),
  imageGrid: css({
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fill, minmax(200px, 1fr))`,
    gap: theme.spacing(2),
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
      margin: theme.spacing(0.5, 0),
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.primary,
    },
  }),
  underlay: css({
    position: 'fixed',
    zIndex: theme.zIndex.modalBackdrop,
    inset: 0,
    backgroundColor: theme.components.overlay.background,
  }),
  overlay: css({
    alignItems: 'center',
    display: 'flex',
    gap: theme.spacing(1),
    height: 'fit-content',
    marginBottom: 'auto',
    marginTop: 'auto',
    padding: theme.spacing(2),
    position: 'fixed',
    inset: 0,
    zIndex: theme.zIndex.modal,
  }),
  closeButton: css({
    color: theme.colors.text.primary,
    position: 'fixed',
    top: theme.spacing(2),
    right: theme.spacing(2),
  }),
});
