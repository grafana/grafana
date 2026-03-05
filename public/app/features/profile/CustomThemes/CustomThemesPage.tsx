import { useState } from 'react';
import { useNavigate } from 'react-router-dom-v5-compat';

import { Theme, useDeleteUserThemeMutation, useListUserThemeQuery } from '@grafana/api-clients/rtkq/theme/v0alpha1';
import { createTheme } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { ConfirmModal, EmptyState, Grid, LinkButton, Stack } from '@grafana/ui';

import { ThemeCard } from '../../themes/ThemeCard';

export default function CustomThemesPage() {
  const customThemes = useListUserThemeQuery({});
  const [deleteTheme] = useDeleteUserThemeMutation();
  const [themeToDelete, setThemeToDelete] = useState<Theme>();
  const navigate = useNavigate();

  return (
    <>
      <Stack direction="column" gap={2}>
        <Stack justifyContent="flex-end">
          {customThemes.isLoading || customThemes.data?.items.length ? (
            <LinkButton icon="plus" href="/profile/themes/new">
              <Trans i18nKey="profile.custom-themes.add-button">Add custom theme</Trans>
            </LinkButton>
          ) : null}
        </Stack>
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
                onEdit={() => navigate(`/profile/themes/${themeOption.metadata.name}/edit`)}
                onRemove={() => setThemeToDelete(themeOption)}
              />
            ))}
          </Grid>
        ) : (
          <EmptyState
            variant="call-to-action"
            button={
              <LinkButton icon="plus" href="/profile/themes/new" size="lg">
                <Trans i18nKey="profile.custom-themes.add-button">Add custom theme</Trans>
              </LinkButton>
            }
            message={t('profile.custom-themes.empty-state', "You haven't added any custom themes yet")}
          >
            <Trans i18nKey="profile.custom-themes.empty-state-description">
              Add a custom theme visible only to you to personalise the look and feel of Grafana
            </Trans>
          </EmptyState>
        )}
      </Stack>
      <ConfirmModal
        title={t('profile.custom-themes.delete-modal.title', 'Delete theme')}
        confirmText={t('profile.custom-themes.delete-modal.confirm-text', 'Delete')}
        body={t('profile.custom-themes.delete-modal.body', 'Are you sure you want to delete the {{name}} theme?', {
          name: themeToDelete?.spec.name,
        })}
        onConfirm={() => {
          deleteTheme({ name: themeToDelete?.metadata.name! });
          setThemeToDelete(undefined);
        }}
        confirmationText={themeToDelete?.spec.name}
        isOpen={Boolean(themeToDelete)}
        onDismiss={() => setThemeToDelete(undefined)}
      />
    </>
  );
}
