import { Trans } from '@grafana/i18n';
import { PluginPage } from '@grafana/runtime';
import { Stack } from '@grafana/ui';

export function Config() {
  return (
    <PluginPage>
      <Stack direction={'column'} gap={4}>
        <section>
          <h3>
            <Trans i18nKey="config-page.header.text">Is this translated</Trans>
          </h3>
        </section>
      </Stack>
    </PluginPage>
  );
}
