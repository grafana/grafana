import { useEffect, useState } from 'react';

import { type CustomCommand } from '@grafana/schema';
import { Button, Field, Input, Stack } from '@grafana/ui';
import { Form } from 'app/core/components/Form/Form';
import { t, Trans } from 'app/core/internationalization';
import { PreferencesService } from 'app/core/services/PreferencesService';

const service = new PreferencesService('user');

interface FieldValues extends CustomCommand {}

export function UserCommands({}) {
  const [savedCommands, setSavedCommands] = useState<CustomCommand[]>([]);

  useEffect(() => {
    fetchCommands();
  }, []);

  const fetchCommands = async () => {
    const { customCommands = [] } = await service.load();
    setSavedCommands(customCommands);
  };

  const onSubmit = async (values: FieldValues) => {
    // excluding for now shortcut and keywords since we need to transform strings to arrays
    const { shortcut, keywords, ...preparedValues } = values;
    await service.patch({ customCommands: [...savedCommands, preparedValues] });
    fetchCommands();
  };

  return (
    <Stack direction="column" gap={4}>
      <Stack direction="column">
        <h3>
          <Trans i18nKey="user-profile.commands.title">Commands</Trans>
        </h3>
        <p>
          <Trans i18nKey="user-profile.commands.subtitle-one">
            Here you can add commands that will be available in the Grafana UI command pallette.
          </Trans>
        </p>
        <p>
          <Trans i18nKey="user-profile.commands.subtitle-two">
            Commands can be used to trigger actions, navigate to pages, or open modals.
          </Trans>
        </p>
      </Stack>
      <div>
        <Form<FieldValues> onSubmit={onSubmit}>
          {({ register, errors }) => {
            return (
              <Stack direction="column" gap={1}>
                <Stack direction="row">
                  <Field label={t('user-profile.commands.id-label', 'ID')} invalid={!!errors.ID}>
                    <Input
                      {...register('ID', { required: true })}
                      id="id-input"
                      placeholder={t('user-profile.commands.id-placeholder', 'ID')}
                    />
                  </Field>
                  <Field label={t('user-profile.commands.title-label', 'Title')} invalid={!!errors.title}>
                    <Input
                      {...register('title', { required: true })}
                      id="title-input"
                      placeholder={t('user-profile.commands.title-placeholder', 'Title')}
                    />
                  </Field>
                  <Field label={t('user-profile.commands.shortcut-label', 'Shortcut')} invalid={!!errors.shortcut}>
                    <Input
                      {...register('shortcut')}
                      id="shortcut-input"
                      placeholder={t('user-profile.commands.shortcut-placeholder', 'Shortcut')}
                    />
                  </Field>
                  <Field label={t('user-profile.commands.path-label', 'Path')} invalid={!!errors.path}>
                    <Input
                      {...register('path')}
                      id="path-input"
                      placeholder={t('user-profile.commands.path-placeholder', 'Path')}
                    />
                  </Field>
                </Stack>
                <Field label={t('user-profile.commands.keywords-label', 'Keywords')} invalid={!!errors.keywords}>
                  <Input
                    {...register('keywords')}
                    id="keywords-input"
                    placeholder={t('user-profile.commands.keywords-placeholder', 'Keywords')}
                  />
                </Field>
                <Field label={t('user-profile.commands.category-label', 'Category')} invalid={!!errors.category}>
                  <Input
                    {...register('category')}
                    id="category-input"
                    placeholder={t('user-profile.commands.category-placeholder', 'Category')}
                  />
                </Field>
                <Button type="submit">{t('user-profile.commands.add-command', 'Add command')}</Button>
              </Stack>
            );
          }}
        </Form>
      </div>
      <div>
        <Trans i18nKey="user-profile.commands.table-title">
          <h3>Saved commands</h3>
        </Trans>
        {savedCommands?.map((command) => <div key={command.ID}>{JSON.stringify(command)}</div>)}
      </div>
    </Stack>
  );
}
