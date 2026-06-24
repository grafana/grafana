import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { Stack, EmptyState, LinkButton, useStyles2 } from '@grafana/ui';

export interface Props {
  /**
   * Defaults to Page
   */
  entity?: string;
}

export function EntityNotFound({ entity = 'Страница' }: Props) {
  const styles = useStyles2(getStyles);
  const lowerCaseEntity = entity.toLowerCase();

  return (
    <div className={styles.container} data-testid={selectors.components.EntityNotFound.container}>
<<<<<<< HEAD
      <EmptyState message={`${entity} не найдена`} variant="not-found">
        Мы ищем, но, похоже, не можем найти эту страницу. Попробуйте вернуться <TextLink href="/">на главную</TextLink>.
=======
      <EmptyState
        message={t('entity-not-found.title', '{{entity}} not found', { entity })}
        variant="not-found"
        button={
          <Stack direction="row" gap={2}>
            <LinkButton icon="arrow-left" href="/">
              <Trans i18nKey="entity-not-found.home-link">Back to Home</Trans>
            </LinkButton>

            <LinkButton
              icon="question-circle"
              href="https://community.grafana.com"
              target="_blank"
              rel="noreferrer"
              variant="secondary"
            >
              <Trans i18nKey="entity-not-found.community-link">Community Help</Trans>
            </LinkButton>
          </Stack>
        }
      >
        <Trans i18nKey="entity-not-found.description">
          We&apos;re looking but can&apos;t seem to find this {{ lowerCaseEntity }}. Please check the URL and try again.
        </Trans>
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
      </EmptyState>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      padding: theme.spacing(8, 2, 2, 2),
    }),
  };
}
