import { css } from '@emotion/css';
import { useMemo } from 'react';

import { ActionModel, Field, GrafanaTheme2, LinkModel } from '@grafana/data';

import { Button, DataLinkButton, Icon, Stack } from '..';
import { useStyles2 } from '../../themes';
import { Trans } from '../../utils/i18n';
import { ActionButton } from '../Actions/ActionButton';

interface VizTooltipFooterProps {
  dataLinks: Array<LinkModel<Field>>;
  actions?: Array<ActionModel<Field>>;
  annotate?: () => void;
}

export const ADD_ANNOTATION_ID = 'add-annotation-button';

const renderDataLinks = (dataLinks: LinkModel[], styles: ReturnType<typeof getStyles>) => {
  const oneClickLink = dataLinks.find((link) => link.oneClick === true);

  if (oneClickLink != null) {
    return (
      <Stack direction="column" justifyContent="flex-start" gap={0.5}>
        <span className={styles.oneClickWrapper}>
          <Icon name="info-circle" size="lg" className={styles.infoIcon} />
          <Trans i18nKey="grafana-ui.viz-tooltip.footer-click-to-navigate">
            Click to open {{ linkTitle: oneClickLink.title }}
          </Trans>
        </span>
      </Stack>
    );
  }

  return (
    <Stack direction="column" justifyContent="flex-start" gap={0.5}>
      {dataLinks.map((link, i) => (
        <DataLinkButton link={link} key={i} buttonProps={{ className: styles.dataLinkButton, fill: 'text' }} />
      ))}
    </Stack>
  );
};

const renderActions = (actions: ActionModel[], styles: ReturnType<typeof getStyles>) => {
  const oneClickAction = actions.find((action) => action.oneClick === true);

  if (oneClickAction != null) {
    return (
      <Stack direction="column" justifyContent="flex-start" gap={0.5}>
        <span className={styles.oneClickWrapper}>
          <Icon name="info-circle" size="lg" className={styles.infoIcon} />
          <Trans i18nKey="grafana-ui.viz-tooltip.footer-click-to-action">
            Click to {{ actionTitle: oneClickAction.title }}
          </Trans>
        </span>
      </Stack>
    );
  }

  return (
    <Stack direction="column" justifyContent="flex-start">
      {actions.map((action, i) => (
        <ActionButton key={i} action={action} variant="secondary" />
      ))}
    </Stack>
  );
};

export const VizTooltipFooter = ({ dataLinks, actions = [], annotate }: VizTooltipFooterProps) => {
  const styles = useStyles2(getStyles);
  const hasOneClickLink = useMemo(() => dataLinks.some((link) => link.oneClick === true), [dataLinks]);
  const hasOneClickAction = useMemo(() => actions.some((action) => action.oneClick === true), [actions]);

  return (
    <div className={styles.wrapper}>
      {!hasOneClickAction && <div className={styles.dataLinks}>{renderDataLinks(dataLinks, styles)}</div>}
      {!hasOneClickLink && <div className={styles.dataLinks}>{renderActions(actions, styles)}</div>}
      {!hasOneClickLink && !hasOneClickAction && annotate != null && (
        <div className={styles.addAnnotations}>
          <Button icon="comment-alt" variant="secondary" size="sm" id={ADD_ANNOTATION_ID} onClick={annotate}>
            <Trans i18nKey="grafana-ui.viz-tooltip.footer-add-annotation">Add annotation</Trans>
          </Button>
        </div>
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    padding: theme.spacing(0),
  }),
  dataLinks: css({
    borderTop: `1px solid ${theme.colors.border.medium}`,
    padding: theme.spacing(1),
  }),
  addAnnotations: css({
    borderTop: `1px solid ${theme.colors.border.medium}`,
    padding: theme.spacing(1),
  }),
  dataLinkButton: css({
    cursor: 'pointer',
    '&:hover': {
      textDecoration: 'underline',
      background: 'none',
    },
  }),
  oneClickWrapper: css({
    display: 'flex',
    alignItems: 'center',
  }),
  infoIcon: css({
    color: theme.colors.primary.main,
    paddingRight: theme.spacing(0.5),
  }),
});
