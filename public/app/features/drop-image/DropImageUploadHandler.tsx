import { css } from '@emotion/css';
import { decodeImageDataCropped } from 'node-stego';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

async function decodePNG(file: File, onProgress?: (percent: number) => void) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const nodeSegoImageData = {
          data: new Uint8Array(imageData.data),
          width: imageData.width,
          height: imageData.height,
        };
        const result = decodeImageDataCropped(nodeSegoImageData);
        if (!result) {
          console.log('No message recovered.');
          resolve(null);
          return null;
        }

        console.log(`Decoded: ${result.message} (votes=${result.votes})`);
        onProgress?.(100);
        resolve(result.message);
        return;
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onprogress = (e) => {
      const percent = Math.round((e.loaded / e.total) * 100);
      onProgress?.(percent);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}


export function DropImageUploadHandler({
  onDecoded,
  children,
}: {
  onDecoded: (url: string) => void;
  children: React.ReactNode;
}) {
  const styles = useStyles2(getStyles);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showInvalidFileMessage, setShowInvalidFileMessage] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const handleFileDrop = async (file: File) => {
    if (file.type !== 'image/png') {
      setShowInvalidFileMessage(true);
      setTimeout(() => {
        setShowInvalidFileMessage(false);
      }, 1000);
      return;
    }

    setIsProcessing(true);
    try {
      const bitstream = await decodePNG(file);
      if (bitstream) {
        setIsProcessing(false);
        setShowSuccessMessage(true);
        setTimeout(() => {
          onDecoded(bitstream as string);
          setShowSuccessMessage(false);
        }, 1000);
      } else {
        setIsProcessing(false);
        console.log('No hidden message found in the image');
        alert('No hidden message found in this PNG.');
      }
    } catch (err) {
      setIsProcessing(false);
      console.error('Decode failed', err);
      alert('Failed to decode PNG.');
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileDrop(file);
    }
  };

  const getOverlayText = () => {
    if (showInvalidFileMessage) {
      return t('drop-image.invalid-file', 'Not a PNG file!');
    }
    if (isProcessing) {
      return t('drop-image.processing', 'Processing the image...');
    }
    if (showSuccessMessage) {
      return t('drop-image.success', 'I found the source of the image, redirecting...');
    }
    if (isDragging) {
      return t('drop-image.drop-png-file-here', 'Drop the PNG file here!');
    }
    return '';
  };

  const shouldShowOverlay = isDragging || isProcessing || showInvalidFileMessage || showSuccessMessage;

  return (
    <div
      onDragOver={(e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`${styles.container} ${isDragging ? styles.containerDragging : ''}`}
    >
      {children}
      {shouldShowOverlay && (
        <div className={styles.overlay}>
          <p className={styles.overlayText}>{getOverlayText()}</p>
        </div>
      )}
    </div>
  );
}


const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    position: 'relative',
    minHeight: '100vh',
    [theme.transitions.handleMotion('no-preference')]: {
      transition: 'background-color 0.5s ease',
    },
  }),
  containerDragging: css({
    backgroundColor: theme.colors.background.secondary,
  }),
  overlay: css({
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.background.primary,
    opacity: 0.8,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: theme.spacing(10),
    pointerEvents: 'none',
    zIndex: theme.zIndex.modal,
  }),
  overlayText: css({
    color: theme.colors.text.primary,
    fontWeight: theme.typography.fontWeightMedium,
    fontSize: theme.typography.h4.fontSize,
  }),
});
