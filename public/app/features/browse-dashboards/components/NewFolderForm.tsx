import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Box, Button, Checkbox, Field, Icon, Input, Space, Stack, Text, Tooltip } from '@grafana/ui';
import { OwnerReference } from 'app/api/clients/folder/v1beta1';
import { FolderDTO } from 'app/types/folders';

import { OwnerReferenceSelector } from '../../../core/components/OwnerReferences/OwnerReferenceSelector';
import { validationSrv } from '../../manage-dashboards/services/ValidationSrv';

interface Props {
  onConfirm: (folderName: string, teamOwnerRefs?: OwnerReference[]) => void;
  onCancel: () => void;
  parentFolder?: FolderDTO;
}

interface FormModel {
  folderName: string;
}

const initialFormModel: FormModel = { folderName: '' };

export function NewFolderForm({ onCancel, onConfirm, parentFolder }: Props) {
  const showFolderOwnerSelector = config.featureToggles.teamFolders;
  const {
    handleSubmit,
    register,
    formState: { errors, isSubmitting },
  } = useForm<FormModel>({ defaultValues: initialFormModel });

  const [createTeamFolder, setCreateTeamFolder] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<OwnerReference | undefined>(undefined);

  const handleTeamFolderToggle = () => {
    setCreateTeamFolder(!createTeamFolder);
  };

  const handleTeamSelectorChange = (ownerRef: OwnerReference) => {
    setSelectedTeam(ownerRef);
  };

  const translatedFolderNameRequiredPhrase = t(
    'browse-dashboards.action.new-folder-name-required-phrase',
    'Folder name is required.'
  );

  const fieldNameLabel = t('browse-dashboards.new-folder-form.name-label', 'Folder name');

  return (
    <form
      name="addFolder"
      onSubmit={handleSubmit((form) =>
        onConfirm(form.folderName, createTeamFolder && selectedTeam ? [selectedTeam] : [])
      )}
      data-testid={selectors.pages.BrowseDashboards.NewFolderForm.form}
    >
      <Stack gap={1} direction="column">
        <Field
          label={fieldNameLabel}
          invalid={!!errors.folderName}
          error={errors.folderName && errors.folderName.message}
          noMargin
        >
          <Input
            data-testid={selectors.pages.BrowseDashboards.NewFolderForm.nameInput}
            id="folder-name-input"
            defaultValue={initialFormModel.folderName}
            {...register('folderName', {
              required: translatedFolderNameRequiredPhrase,
              validate: async (v) => await validateFolderName(v, parentFolder?.uid),
            })}
          />
        </Field>
        {showFolderOwnerSelector && (
          <>
            <Box>
              <Checkbox
                value={createTeamFolder}
                label={t(
                  'browse-dashboards.action.new-folder-owner-selector-checkbox',
                  'Assign an owner to the folder'
                )}
                onChange={handleTeamFolderToggle}
              />
              <Tooltip
                content={t(
                  'browse-dashboards.action.new-folder-as-team-folder-checkbox-tooltip',
                  'Team folders are folders owned by your team. Use them to keep your team’s content in one place—making it easier to find, organize, and manage access'
                )}
                placement="top"
              >
                <Icon name="question-circle" />
              </Tooltip>
            </Box>

            {createTeamFolder && (
              <Stack gap={1} direction="column">
                <Text element="p">
                  <Trans i18nKey="browse-dashboards.action.new-folder-as-team-folder-label">Team:</Trans>
                </Text>
                <OwnerReferenceSelector onChange={handleTeamSelectorChange} />
              </Stack>
            )}
          </>
        )}
      </Stack>
      <Space v={2} />
      <Stack>
        <Button variant="secondary" fill="outline" onClick={onCancel}>
          <Trans i18nKey="browse-dashboards.new-folder-form.cancel-label">Cancel</Trans>
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          <Trans i18nKey="browse-dashboards.new-folder-form.create-label">Create</Trans>
        </Button>
      </Stack>
    </form>
  );
}

export async function validateFolderName(folderName: string, parentFolderUid?: string) {
  try {
    await validationSrv.validateNewFolderName(folderName, parentFolderUid);
    return true;
  } catch (e) {
    if (e instanceof Error) {
      return e.message;
    } else {
      throw e;
    }
  }
}
