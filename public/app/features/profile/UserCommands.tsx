import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { type CustomCommand } from '@grafana/schema';
import { Button, Field, Input, Stack, TagsInput, Text } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { PreferencesService } from 'app/core/services/PreferencesService';

import ShortcutBadge from '../commandPalette/Shortcut';

const service = new PreferencesService('user');

export function UserCommands({}) {
  const [savedCommands, setSavedCommands] = useState<CustomCommand[]>([]);

  const {
    control,
    register,
    formState: { errors },
    handleSubmit,
    reset,
  } = useForm<CustomCommand>();

  useEffect(() => {
    fetchCommands();
  }, []);

  const fetchCommands = async () => {
    const { customCommands = [] } = await service.load();
    setSavedCommands(customCommands);
  };

  const onSubmit = async (values: CustomCommand) => {
    await service.patch({
      customCommands: [{ ...values, ID: `user-defined/${toKebabCase(values.title)}` }, ...savedCommands],
    });
    fetchCommands();
    reset();
  };

  return (
    <Stack direction="column" gap={6}>
      <Stack direction="column" gap={2} maxWidth="600px">
        <h3>
          <Trans i18nKey="user-profile.commands.title">Commands</Trans>
        </h3>
        <Text>
          <Trans i18nKey="user-profile.commands.subtitle-one">
            Add commands that will be available in the Grafana UI command pallette.
          </Trans>
          <br />
          <Trans i18nKey="user-profile.commands.subtitle-two">
            They can be used to trigger various actions or navigate to pages.
          </Trans>
        </Text>

        <div>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Stack direction="column" gap={1}>
              <Field label={t('user-profile.commands.title-label', 'Title')} invalid={!!errors.title}>
                <Input
                  {...register('title', { required: true })}
                  id="title-input"
                  placeholder={t('user-profile.commands.title-placeholder', 'Title')}
                />
              </Field>
              <Stack direction="row" width="100%">
                <Field
                  style={{ flex: 1 }}
                  label={t('user-profile.commands.shortcuts-label', 'Shortcuts')}
                  invalid={!!errors.shortcut}
                >
                  <Controller
                    control={control}
                    name="shortcut"
                    render={({ field }) => (
                      <TagsInput
                        id="shortcuts-input"
                        tags={field.value}
                        onChange={(tags) => field.onChange(tags)}
                        placeholder={t('user-profile.commands.shortcuts-placeholder', 'Shortcuts')}
                      />
                    )}
                  />
                </Field>
                <Field
                  style={{ flex: 1 }}
                  label={t('user-profile.commands.path-label', 'Path')}
                  invalid={!!errors.path}
                >
                  <Input
                    {...register('path', { required: true })}
                    id="path-input"
                    placeholder={t('user-profile.commands.path-placeholder', 'Path')}
                  />
                </Field>
              </Stack>
              <Field label={t('user-profile.commands.keywords-label', 'Keywords')} invalid={!!errors.keywords}>
                <Controller
                  control={control}
                  name="keywords"
                  render={({ field }) => (
                    <TagsInput
                      id="keywords-input"
                      tags={field.value}
                      onChange={(tags) => field.onChange(tags)}
                      placeholder={t('user-profile.commands.keywords-placeholder', 'Keywords')}
                    />
                  )}
                />
              </Field>
              <Field label={t('user-profile.commands.category-label', 'Category')} invalid={!!errors.category}>
                <Input
                  {...register('category', { required: true })}
                  id="category-input"
                  placeholder={t('user-profile.commands.category-placeholder', 'Category')}
                />
              </Field>
              <Stack>
                <Button variant="primary" type="submit">
                  <Trans i18nKey="common.save">Save</Trans>
                </Button>
              </Stack>
            </Stack>
          </form>
        </div>
      </Stack>
      <div>
        <h3 className="page-sub-heading">
          <Trans i18nKey="user-profile.commands-table.title">Commands</Trans>
        </h3>

        {savedCommands.length === 0 ? (
          <Text color="secondary">
            <Trans i18nKey="user-profile.commands.no-commands">No commands added yet</Trans>
            <br />
          </Text>
        ) : (
          <table className="filter-table form-inline">
            <thead>
              <tr>
                <th>
                  <Trans i18nKey="user-profile.commands-table.title-column">Title</Trans>
                </th>
                <th>
                  <Trans i18nKey="user-profile.commands-table.category-column">Category</Trans>
                </th>
                <th>
                  <Trans i18nKey="user-profile.commands-table.keywords-column">Keywords</Trans>
                </th>
                <th>
                  <Trans i18nKey="user-profile.commands-table.shortcuts-column">Shortcut</Trans>
                </th>
                <th>
                  <Trans i18nKey="user-profile.commands-table.path-column">Path</Trans>
                </th>
              </tr>
            </thead>
            <tbody>
              {savedCommands.map((command: CustomCommand) => {
                return (
                  <tr key={command.ID}>
                    <td>{command.title}</td>
                    <td>{command.category}</td>
                    <td>{command.keywords?.join(', ')}</td>
                    <td>
                      <ShortcutBadge shortcut={command.shortcut} />
                    </td>
                    <td>{command.path}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </Stack>
  );
}

function toKebabCase(str: string) {
  return str
    .trim() // Remove leading/trailing whitespace
    .toLowerCase() // Convert to lowercase
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric characters with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}
