import { css } from '@emotion/css';
import { useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { Stack, EmptyState, LinkButton, useStyles2 } from '@grafana/ui';

import { getFooterLinks } from '../Footer/Footer';

export interface Props {
  /**
   * Defaults to Page
   */
  entity?: string;
}

export function EntityNotFound({ entity = 'Page' }: Props) {
  const styles = useStyles2(getStyles);
  const lowerCaseEntity = entity.toLowerCase();

  const communityLinkInfo = useMemo(() => {
    const footerLinks = getFooterLinks();
    const link = footerLinks.find((l) => l.id === 'community');
    const url = link?.url;

    if (!url) {
      return undefined;
    }

    const defaultText = t('nav.help/community', 'Community');
    const isCustomText = link?.text && link.text !== defaultText;

    // Override the default footer UTM attribution with one specific to this component
    let finalUrl = url;
    if (url.includes('utm_source=grafana_footer')) {
      finalUrl = url.replace('utm_source=grafana_footer', 'utm_source=entity_not_found');
    }

    return {
      url: finalUrl,
      text: isCustomText ? link.text : undefined,
    };
  }, []);

  return (
    <div className={styles.container} data-testid={selectors.components.EntityNotFound.container}>
      <EmptyState
        message={t('entity-not-found.title', '{{entity}} not found', { entity })}
        variant="not-found"
        button={
          <Stack direction="row" gap={2}>
            <LinkButton icon="arrow-left" href="/">
              <Trans i18nKey="entity-not-found.home-link">Back to Home</Trans>
            </LinkButton>

            {communityLinkInfo && (
              <LinkButton
                icon="question-circle"
                href={communityLinkInfo.url}
                target="_blank"
                rel="noreferrer"
                variant="secondary"
              >
                {communityLinkInfo.text ?? <Trans i18nKey="entity-not-found.community-link">Community Help</Trans>}
              </LinkButton>
            )}
          </Stack>
        }
      >
        <Trans i18nKey="entity-not-found.description">
          We&apos;re looking but can&apos;t seem to find this {{ lowerCaseEntity }}. Please check the URL and try again.
        </Trans>
      </EmptyState>
    </div>
  );
}

export function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      padding: theme.spacing(8, 2, 2, 2),
    }),
  };
}
