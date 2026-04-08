import { useSearchParams } from 'react-router-dom-v5-compat';

import { t, Trans } from '@grafana/i18n';
import { Alert, TextLink } from '@grafana/ui';

interface TemplateSavedBannerProps {
  templateName: string;
}

export function TemplateSavedBanner({ templateName }: TemplateSavedBannerProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  const onDismiss = () => {
    searchParams.delete('templateSaved');
    setSearchParams(searchParams);
  };

  const onOpenGallery = () => {
    searchParams.set('templateDashboards', 'true');
    setSearchParams(searchParams);
  };

  return (
    <Alert
      title={t('dashboard-scene.template-saved-banner.title', 'Template created')}
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
