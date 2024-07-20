import { css } from '@emotion/css';

import { ActionModel, Field, GrafanaTheme2, LinkModel } from '@grafana/data';

import { Button, ButtonProps, DataLinkButton, Stack } from '..';
import { useStyles2 } from '../../themes';
import { ActionButton } from '../DataLinks/DataLinkButton';

interface VizTooltipFooterProps {
  dataLinks: Array<LinkModel<Field>>;
  actions?: Array<ActionModel<Field>>;
  annotate?: () => void;
}

export const ADD_ANNOTATION_ID = 'add-annotation-button';

const renderDataLinks = (dataLinks: LinkModel[]) => {
  const buttonProps: ButtonProps = {
    variant: 'secondary',
  };

  return (
    <Stack direction="column" justifyContent="flex-start">
      {dataLinks.map((link, i) => (
        <DataLinkButton key={i} link={link} buttonProps={buttonProps} />
      ))}
    </Stack>
  );
};

const renderActions = (actions: ActionModel[]) => {
  const buttonProps: ButtonProps = {
    variant: 'secondary',
  };

  return (
    <Stack direction="column" justifyContent="flex-start">
      {actions.map((action, i) => (
        <ActionButton key={i} action={action} buttonProps={buttonProps} />
      ))}
    </Stack>
  );
};

export const VizTooltipFooter = ({ dataLinks, actions, annotate }: VizTooltipFooterProps) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      {dataLinks.length > 0 && <div className={styles.dataLinks}>{renderDataLinks(dataLinks)}</div>}
      {actions && actions.length > 0 && <div className={styles.dataLinks}>{renderActions(actions)}</div>}
      {annotate != null && (
        <div className={styles.addAnnotations}>
          <Button icon="comment-alt" variant="secondary" size="sm" id={ADD_ANNOTATION_ID} onClick={annotate}>
            Add annotation
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
});
