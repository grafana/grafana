import { t, Trans } from '@grafana/i18n';
import { Alert, TextLink } from '@grafana/ui';

interface TemplateSavedBannerProps {
  templateName: string;
  onDismiss: () => void;
  onOpenGallery: () => void;
}

export function TemplateSavedBanner({ templateName, onDismiss, onOpenGallery }: TemplateSavedBannerProps) {
  return (
    <Alert
      title={t('dashboard-scene.template-saved-banner.title', 'Template saved')}
      severity="success"
      style={{ flex: 0 }}
      onRemove={onDismiss}
    >
      <Trans i18nKey="dashboard-scene.template-saved-banner.body" values={{ templateName }}>
        {'The {{ templateName }} template was created. You can access it in the '}
        <TextLink
          href=""
          onClick={(e) => {
            e.preventDefault();
            onOpenGallery();
          }}
          inline
        >
          template gallery
        </TextLink>
        .
      </Trans>
    </Alert>
  );
}
