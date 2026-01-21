import { useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { SceneComponentProps, SceneObjectBase } from '@grafana/scenes';
import { Button, Field, Input, Stack, TextArea } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { DashboardScene } from '../scene/DashboardScene';
import { NavToolbarActions } from '../scene/NavToolbarActions';
import { getDashboardSceneFor } from '../utils/utils';

import { DashboardEditView, DashboardEditViewState, useDashboardEditPageNav } from './utils';

export interface ThemeEditViewState extends DashboardEditViewState {}

export class ThemeEditView extends SceneObjectBase<ThemeEditViewState> implements DashboardEditView {
  private get _dashboard(): DashboardScene {
    return getDashboardSceneFor(this);
  }

  public getUrlKey(): string {
    return 'theme';
  }

  public getDashboard(): DashboardScene {
    return this._dashboard;
  }

  public static Component = ({ model }: SceneComponentProps<ThemeEditView>) => {
    const dashboard = model.getDashboard();
    const { navModel, pageNav } = useDashboardEditPageNav(dashboard, 'theme');
    const [customCSS, setCustomCSS] = useState(dashboard.state.customCSS || '');
    const [backgroundImage, setBackgroundImage] = useState(dashboard.state.backgroundImage || '');

    const onCustomCSSChange = (css: string) => {
      dashboard.setState({ customCSS: css });
      setCustomCSS(css);
    };

    const onBackgroundImageChange = (url: string) => {
      dashboard.setState({ backgroundImage: url });
      setBackgroundImage(url);
    };

    const onClearBackgroundImage = () => {
      dashboard.setState({ backgroundImage: undefined });
      setBackgroundImage('');
    };

    return (
      <Page navModel={navModel} pageNav={pageNav}>
        <NavToolbarActions dashboard={dashboard} />
        <div style={{ maxWidth: '600px' }}>
          <Trans i18nKey="dashboard.theme-settings.description">
            Customize the appearance of this dashboard with custom CSS and brand colors.
          </Trans>

          <Field
            label={t('dashboard.theme-settings.background-image.label', 'Background Image')}
            description={t(
              'dashboard.theme-settings.background-image.description',
              'Set a background image URL for this dashboard. The image will be displayed behind all panels.'
            )}
          >
            <Input
              value={backgroundImage}
              onChange={(e) => onBackgroundImageChange(e.currentTarget.value)}
              placeholder={t(
                'dashboard.theme-settings.background-image.placeholder',
                'https://example.com/image.jpg'
              )}
            />
          </Field>
          {backgroundImage && (
            <Stack gap={2} direction="column" style={{ marginBottom: '16px' }}>
              <Button variant="secondary" onClick={onClearBackgroundImage} icon="times">
                {t('dashboard.theme-settings.background-image.clear', 'Clear')}
              </Button>
              <div
                style={{
                  padding: '8px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                }}
              >
                <img
                  src={backgroundImage}
                  alt={t('dashboard.theme-settings.background-image.preview', 'Background image preview')}
                  style={{ maxWidth: '100%', maxHeight: '200px', display: 'block' }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            </Stack>
          )}

          <Field
            label={t('dashboard.theme-settings.custom-css.label', 'Custom CSS')}
            description={t(
              'dashboard.theme-settings.custom-css.description',
              'Add custom CSS styles that will be applied to this dashboard.'
            )}
          >
            <TextArea
              rows={10}
              value={customCSS}
              onChange={(e) => onCustomCSSChange(e.currentTarget.value)}
              placeholder={t(
                'dashboard.theme-settings.custom-css.placeholder',
                '/* Custom CSS for this dashboard */\n.dashboard-container {\n  /* Your styles here */\n}'
              )}
            />
          </Field>
        </div>
      </Page>
    );
  };
}
