import { css } from '@emotion/css';
import { type PropsWithChildren } from 'react';

import { type GrafanaTheme2, locationUtil } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Icon, LinkButton, Stack, Text, Toggletip, useStyles2 } from '@grafana/ui';

import { type AttributePluginPromo } from './attributePluginPromos';

type Props = PropsWithChildren<{
  promo: AttributePluginPromo;
}>;

/**
 * Clickable attribute-value wrapper that promotes installing or activating a related app plugin.
 */
export function AttributePluginPromoTip({ promo, children }: Props) {
  const styles = useStyles2(getStyles);
  const catalogUrl = locationUtil.assureBaseUrl(`/plugins/${promo.pluginId}`);

  const onLearnMoreClick = () => {
    reportInteraction('grafana_traces_trace_view_attribute_plugin_promo_clicked', {
      pluginId: promo.pluginId,
    });
  };

  return (
    <Toggletip
      title={
        <div className={styles.content}>
          <Stack gap={0.5} direction="row" alignItems="center">
            <Icon name={promo.icon} size="sm" />
            <Text element="span" variant="body" weight="medium">
              {promo.title}
            </Text>
          </Stack>
        </div>
      }
      content={
        <div className={styles.content}>
          <p className={styles.body}>{promo.body}</p>
        </div>
      }
      footer={
        <LinkButton href={catalogUrl} size="sm" onClick={onLearnMoreClick}>
          <Trans i18nKey="explore.trace-view.attribute-plugin-promo.learn-more">Learn more</Trans>
        </LinkButton>
      }
      placement="top"
    >
      <button type="button" className={styles.trigger} data-testid="attribute-plugin-promo-trigger">
        <Icon name={promo.icon} size="sm" className={styles.triggerIcon} />
        {children}
      </button>
    </Toggletip>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  trigger: css({
    display: 'inline-flex',
    // attribute values wrap, so keep the icon on the first line instead of centering it across all of them
    alignItems: 'flex-start',
    gap: theme.spacing(0.5),
    padding: 0,
    margin: 0,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: theme.colors.text.link,
    font: 'inherit',
    textAlign: 'left',
    '&:hover': {
      textDecoration: 'underline',
    },
    // Match KeyValuesTable link styling so json-markup spans use the link color
    span: {
      color: `${theme.colors.text.link} !important`,
    },
  }),
  triggerIcon: css({
    flexShrink: 0,
    color: `${theme.colors.text.primary} !important`,
  }),
  content: css({
    maxWidth: 300,
  }),
  body: css({
    margin: 0,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightRegular,
    lineHeight: theme.typography.bodySmall.lineHeight,
  }),
});
