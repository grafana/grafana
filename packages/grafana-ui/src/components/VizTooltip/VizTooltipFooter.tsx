import { css } from '@emotion/css';

import { ActionModel, Field, GrafanaTheme2, LinkModel } from '@grafana/data';

import { Button, DataLinkButton, Stack } from '..';
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

export const VizTooltipFooter = ({ dataLinks, actions, annotate }: VizTooltipFooterProps) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      {dataLinks?.length > 0 && <div className={styles.dataLinks}>{renderDataLinks(dataLinks, styles)}</div>}
      {actions && actions.length > 0 && <div className={styles.dataLinks}>{renderActions(actions)}</div>}
      {annotate != null && (
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
});
