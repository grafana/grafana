import { E2ESelectors } from '@grafana/e2e-selectors';

export const ExportImageComponents = {
  formatOptions: {
    container: 'data-testid export-image-format-options',
    png: 'data-testid export-image-format-png',
    jpg: 'data-testid export-image-format-jpg',
  },
  rendererAlert: {
    container: 'data-testid export-image-renderer-alert',
    title: 'data-testid export-image-renderer-alert-title',
    description: 'data-testid export-image-renderer-alert-description',
  },
  buttons: {
    generate: 'data-testid export-image-generate-button',
    download: 'data-testid export-image-download-button',
    cancel: 'data-testid export-image-cancel-button',
  },
  preview: {
    container: 'data-testid export-image-preview-container',
    loading: 'data-testid export-image-preview-loading',
    image: 'data-testid export-image-preview',
    error: {
      container: 'data-testid export-image-error',
      title: 'data-testid export-image-error-title',
      message: 'data-testid export-image-error-message',
    },
  },
};

export const selectors: { components: E2ESelectors<typeof ExportImageComponents> } = {
  components: ExportImageComponents,
};
