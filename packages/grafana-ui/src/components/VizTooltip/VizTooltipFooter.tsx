import { css } from '@emotion/css';

import { ActionModel, Field, GrafanaTheme2, LinkModel, OneClickMode } from '@grafana/data';

import { Button, DataLinkButton, Icon, Stack } from '..';
import { useStyles2 } from '../../themes';
import { Trans } from '../../utils/i18n';
import { ActionButton } from '../Actions/ActionButton';

interface VizTooltipFooterProps {
  dataLinks: Array<LinkModel<Field>>;
  actions?: Array<ActionModel<Field>>;
  annotate?: () => void;
  oneClickMode?: OneClickMode;
}

export const ADD_ANNOTATION_ID = 'add-annotation-button';

const renderDataLinks = (dataLinks: LinkModel[], styles: ReturnType<typeof getStyles>, oneClickEnabled = false) => {
  if (oneClickEnabled) {
    const primaryLink = dataLinks[0];

    return (
      <Stack direction="column" justifyContent="flex-start" gap={0.5}>
        <span className={styles.oneClickWrapper}>
          <Icon name="info-circle" size="lg" className={styles.infoIcon} />
          <Trans i18nKey="grafana-ui.viz-tooltip.footer-click-to-navigate">
            Click to open {{ linkTitle: primaryLink.title }}
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

const renderActions = (actions: ActionModel[]) => {
  return (
    <Stack direction="column" justifyContent="flex-start">
      {actions.map((action, i) => (
        <ActionButton key={i} action={action} variant="secondary" />
      ))}
    </Stack>
  );
};

export const VizTooltipFooter = ({ dataLinks, actions, annotate, oneClickMode }: VizTooltipFooterProps) => {
  const styles = useStyles2(getStyles);
  const oneClickEnabled = oneClickMode && oneClickMode !== OneClickMode.Off;

  return (
    <div className={styles.wrapper}>
      {dataLinks.length > 0 && (
        <div className={styles.dataLinks}>{renderDataLinks(dataLinks, styles, oneClickMode === OneClickMode.Link)}</div>
      )}
      {actions && actions.length > 0 && !oneClickEnabled && (
        <div className={styles.dataLinks}>{renderActions(actions)}</div>
      )}
      {annotate != null && !oneClickEnabled && (
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
