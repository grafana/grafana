import { Field, Input, Stack } from '@grafana/ui';
import { Form } from 'app/core/components/Form/Form';
import { t, Trans } from 'app/core/internationalization';

export function UserCommands({}) {
  return (
    <Stack direction="column" gap={1}>
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

      <div>
        <Form onSubmit={() => console.log('Submitting form')}>
          {({ register, errors }) => {
            return (
              <Stack direction="column" gap={1}>
                <Stack direction="row">
                  <Field label={t('user-profile.commands.shortcut-label', 'Shortcut')} invalid={!!errors.shortcut}>
                    <Input
                      {...register('shortcut', { required: true })}
                      id="shortcut-input"
                      placeholder={t('user-profile.commands.shortcut-placeholder', 'Shortcut')}
                    />
                  </Field>
                  <Field label={t('user-profile.commands.path-label', 'Path')} invalid={!!errors.path}>
                    <Input
                      {...register('path', { required: true })}
                      id="path-input"
                      placeholder={t('user-profile.commands.path-placeholder', 'Path')}
                    />
                  </Field>
                </Stack>
                <Field label={t('user-profile.commands.keywords-label', 'Keywords')} invalid={!!errors.keywords}>
                  <Input
                    {...register('keywords', { required: true })}
                    id="keywords-input"
                    placeholder={t('user-profile.commands.keywords-placeholder', 'Keywords')}
                  />
                </Field>
                <Field label={t('user-profile.commands.category-label', 'Category')} invalid={!!errors.category}>
                  <Input
                    {...register('category', { required: true })}
                    id="category-input"
                    placeholder={t('user-profile.commands.category-placeholder', 'Category')}
                  />
                </Field>
              </Stack>
            );
          }}
        </Form>
      </div>
      <div>
        <Trans i18nKey="user-profile.commands.table-title">Command Table</Trans>
      </div>
    </Stack>
  );
}
