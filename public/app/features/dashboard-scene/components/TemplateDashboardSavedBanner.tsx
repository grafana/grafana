import { css } from '@emotion/css';
import { useSearchParams } from 'react-router-dom-v5-compat';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Alert, TextLink, useStyles2 } from '@grafana/ui';

export function TemplateDashboardSavedBanner({ templateName }: { templateName: string }) {
  const styles = useStyles2(getStyles);
  const [searchParams, setSearchParams] = useSearchParams();

  const onDismiss = () => {
    searchParams.delete('templateSaved');
    setSearchParams(searchParams);
  };

  const onOpenGallery = () => {
    searchParams.set('templateDashboards', 'true');
    setSearchParams(searchParams);
  };

  if (!searchParams.get('templateSaved')) {
    return null;
  }

  return (
    <Alert
      title={t('dashboard-scene.template-saved-banner.title', 'Template created')}
      severity="success"
      className={styles.banner}
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

const getStyles = (theme: GrafanaTheme2) => ({
  banner: css({
    flex: 0,
    margin: theme.spacing(2, 2, 0, 2),
  }),
});
