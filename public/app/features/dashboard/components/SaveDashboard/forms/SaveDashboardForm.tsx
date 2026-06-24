import { css } from '@emotion/css';
import { useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { type Dashboard } from '@grafana/schema';
import { Button, Checkbox, TextArea, useStyles2, Stack } from '@grafana/ui';
import { type DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { type SaveDashboardResponseDTO } from 'app/types/dashboard';

import { GenAIDashboardChangesButton } from '../../GenAI/GenAIDashboardChangesButton';
import { type SaveDashboardData, type SaveDashboardOptions } from '../types';

export type SaveProps = {
  dashboard: DashboardModel; // original
  isLoading: boolean;
  saveModel: SaveDashboardData; // already cloned
  onCancel: () => void;
  onSuccess: () => void;
  onSubmit?: (
    saveModel: Dashboard,
    options: SaveDashboardOptions,
    dashboard: DashboardModel
  ) => Promise<SaveDashboardResponseDTO>;
  options: SaveDashboardOptions;
  onOptionsChange: (opts: SaveDashboardOptions) => void;
};

export const SaveDashboardForm = ({
  dashboard,
  isLoading,
  saveModel,
  options,
  onSubmit,
  onCancel,
  onSuccess,
  onOptionsChange,
}: SaveProps) => {
  const hasTimeChanged = useMemo(() => dashboard.hasTimeChanged(), [dashboard]);
  const hasVariableChanged = useMemo(() => dashboard.hasVariablesChanged(), [dashboard]);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(options.message);
  const styles = useStyles2(getStyles);

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        if (!onSubmit) {
          return;
        }
        setSaving(true);
        options = { ...options, message };
        const result = await onSubmit(saveModel.clone, options, dashboard);
        if (result.status === 'success') {
          onSuccess();
        } else {
          setSaving(false);
        }
      }}
      style={{ maxWidth: 600 }}
    >
      <Stack gap={2} direction="column" alignItems="flex-start">
        {hasTimeChanged && (
          <Checkbox
            checked={!!options.saveTimerange}
            onChange={() =>
              onOptionsChange({
                ...options,
                saveTimerange: !options.saveTimerange,
              })
            }
<<<<<<< HEAD
            label="Сохранить текущий диапазон времени в качестве значения дашборда по умолчанию"
            aria-label={selectors.pages.SaveDashboardModal.saveTimerange}
=======
            label={t(
              'dashboard.save-dashboard-form.label-current-range-dashboard-default',
              'Save current time range as dashboard default'
            )}
            data-testid={selectors.pages.SaveDashboardModal.saveTimerange}
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
          />
        )}
        {hasVariableChanged && (
          <Checkbox
            checked={!!options.saveVariables}
            onChange={() =>
              onOptionsChange({
                ...options,
                saveVariables: !options.saveVariables,
              })
            }
<<<<<<< HEAD
            label="Сохранение текущих значений переменных в качестве значений дашборда по умолчанию"
            aria-label={selectors.pages.SaveDashboardModal.saveVariables}
=======
            label={t(
              'dashboard.save-dashboard-form.label-current-variable-values-dashboard-default',
              'Save current variable values as dashboard default'
            )}
            data-testid={selectors.pages.SaveDashboardModal.saveVariables}
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
          />
        )}
        <div className={styles.message}>
          {config.featureToggles.aiGeneratedDashboardChanges && (
            <GenAIDashboardChangesButton
              dashboard={dashboard}
              onGenerate={(text) => {
                onOptionsChange({
                  ...options,
                  message: text,
                });
                setMessage(text);
              }}
              disabled={!saveModel.hasChanges}
            />
          )}
          <TextArea
            value={message}
            onChange={(e) => {
              onOptionsChange({
                ...options,
                message: e.currentTarget.value,
              });
              setMessage(e.currentTarget.value);
            }}
<<<<<<< HEAD
            placeholder="Добавьте примечание с описанием ваших изменений."
=======
            placeholder={t(
              'dashboard.save-dashboard-form.placeholder-describe-changes',
              'Add a note to describe your changes.'
            )}
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
            autoFocus
            rows={5}
          />
        </div>

        <Stack alignItems="center">
          <Button variant="secondary" onClick={onCancel} fill="outline">
<<<<<<< HEAD
            Отмена
=======
            <Trans i18nKey="dashboard.save-dashboard-form.cancel">Cancel</Trans>
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
          </Button>
          <Button
            type="submit"
            disabled={!saveModel.hasChanges || isLoading}
            icon={saving ? 'spinner' : undefined}
            data-testid={selectors.pages.SaveDashboardModal.save}
          >
<<<<<<< HEAD
            {isLoading ? 'Сохранение...' : 'Сохранить'}
          </Button>
          {!saveModel.hasChanges && <div>Нет изменений для сохранения</div>}
=======
            {isLoading
              ? t('dashboard.save-dashboard-form.saving', 'Saving...')
              : t('dashboard.save-dashboard-form.save', 'Save')}
          </Button>
          {!saveModel.hasChanges && (
            <div>
              <Trans i18nKey="dashboard.save-dashboard-form.no-changes-to-save">No changes to save</Trans>
            </div>
          )}
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
        </Stack>
      </Stack>
    </form>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    message: css({
      display: 'flex',
      alignItems: 'end',
      flexDirection: 'column',
      width: '100%',
    }),
  };
}
