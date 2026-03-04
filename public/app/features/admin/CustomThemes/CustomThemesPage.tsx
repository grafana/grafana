import { useState } from 'react';
import { useNavigate } from 'react-router-dom-v5-compat';

import { Theme, useDeleteThemeMutation, useListThemeQuery } from '@grafana/api-clients/rtkq/theme/v0alpha1';
import { createTheme } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { ConfirmModal, EmptyState, Grid, LinkButton } from '@grafana/ui';

import { Page } from '../../../core/components/Page/Page';

import { ThemeCard } from './ThemeCard';

export default function CustomThemesPage() {
  const customThemes = useListThemeQuery({});
  const [deleteTheme] = useDeleteThemeMutation();
  const [themeToDelete, setThemeToDelete] = useState<Theme>();
  const navigate = useNavigate();

  return (
    <Page
      navId="custom-themes"
      actions={
        customThemes.isLoading || customThemes.data?.items.length ? (
          <LinkButton icon="plus" href="/themes/new">
            <Trans i18nKey="admin.custom-themes.add-button">Add custom theme</Trans>
          </LinkButton>
        ) : undefined
      }
    >
      {customThemes.isLoading ? (
        <Grid minColumnWidth={34} gap={2}>
          {Array.from({ length: 3 }, (_, i) => (
            <ThemeCard.Skeleton key={i} />
          ))}
        </Grid>
      ) : customThemes.data?.items.length ? (
        <Grid minColumnWidth={34} gap={2}>
          {customThemes.data.items.map((themeOption) => (
            <ThemeCard
              themeOption={{
                id: themeOption.metadata.uid!,
                name: themeOption.spec.name,
                isExtra: true,
                build: () => createTheme(themeOption.spec),
              }}
              key={themeOption.metadata.uid}
              onEdit={() => navigate(`/themes/${themeOption.metadata.name}/edit`)}
              onRemove={() => setThemeToDelete(themeOption)}
            />
          ))}
        </Grid>
      ) : (
        <EmptyState
          variant="call-to-action"
          button={
            <LinkButton icon="plus" href="/themes/new" size="lg">
              <Trans i18nKey="admin.custom-themes.add-button">Add custom theme</Trans>
            </LinkButton>
          }
          message={t('admin.custom-themes.empty-state', 'No custom themes')}
        >
          <Trans i18nKey="admin.custom-themes.empty-state-description">
            Add a custom theme to apply a unique look and feel to your organization.
          </Trans>
        </EmptyState>
      )}
      <ConfirmModal
        title={t('admin.custom-themes.delete-modal.title', 'Delete custom theme')}
        confirmText={t('admin.custom-themes.delete-modal.confirm-text', 'Delete')}
        body={t('admin.custom-themes.delete-modal.body', 'Are you sure you want to delete the {{name}} theme?', {
          name: themeToDelete?.spec.name,
        })}
        onConfirm={() => {
          deleteTheme({ name: themeToDelete?.metadata.name! });
          setThemeToDelete(undefined);
        }}
        confirmationText={themeToDelete?.metadata.name}
        isOpen={Boolean(themeToDelete)}
        onDismiss={() => setThemeToDelete(undefined)}
      />
    </Page>
  );
}
