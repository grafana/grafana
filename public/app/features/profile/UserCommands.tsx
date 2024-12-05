import { useState, useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Button, Field, Input, Stack, TagsInput, Text } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

interface CustomCommand {
  id: string;
  title: string;
  path?: string;
  shortcut?: string[];
  keywords?: string[];
  category?: string;
}

const mockCommands: CustomCommand[] = [
  {
    id: 'create-incident',
    title: 'Create Incident',
    path: 'irm/create-incident',
    shortcut: ['/ci'],
    keywords: ['incident', 'create', 'new'],
    category: 'IRM',
  },
];

export function UserCommands({}) {
  const [commands, setCommands] = useState<CustomCommand[]>(mockCommands);

  const {
    control,
    register,
    formState: { errors },
    handleSubmit,
    reset,
  } = useForm<CustomCommand>();

  useEffect(() => {
    // Fetch commands from API
  }, []);

  const onSubmit = (data: CustomCommand) => {
    // Save command to API
    setCommands([...commands, data]);
    reset();
  };

  const onDelete = (id: string) => {
    // Delete command from API
    setCommands(commands.filter((command) => command.id !== id));
  };

  return (
    <Stack direction="column" gap={6}>
      <Stack direction="column" gap={2} maxWidth="600px">
        <h3>
          <Trans i18nKey="user-profile.commands.title">Commands</Trans>
        </h3>
        <Text>
          <Trans i18nKey="user-profile.commands.subtitle-one">
            Here you can add commands that will be available in the Grafana UI command pallette.
          </Trans>
          <br />
          <Trans i18nKey="user-profile.commands.subtitle-two">
            Commands can be used to trigger actions, navigate to pages, or open modals.
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
                <Trans i18nKey="user-profile.commands-table.shortcuts-column">Shortcuts</Trans>
              </th>
              <th>
                <Trans i18nKey="user-profile.commands-table.path-column">Path</Trans>
              </th>
              <th />
            </tr>
          </thead>
          <tbody>
            {commands.map((command: CustomCommand, index) => {
              return (
                <tr key={index}>
                  <td>{command.title}</td>
                  <td>{command.category}</td>
                  <td>{command.keywords?.join(', ')}</td>
                  <td>{command.shortcut?.join(', ') ?? ''}</td>
                  <td>{command.path}</td>
                  <td className="text-right">
                    <Button variant="destructive" size="sm" onClick={() => onDelete(command.id)}>
                      <Trans i18nKey="user-profile.commands-table.delete-button">Delete</Trans>
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Stack>
  );
}
