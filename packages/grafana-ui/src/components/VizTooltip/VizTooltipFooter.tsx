import { css } from '@emotion/css';
import React from 'react';

import { Field, GrafanaTheme2, LinkModel } from '@grafana/data';

import { Button, ButtonProps, DataLinkButton, HorizontalGroup } from '..';
import { useStyles2 } from '../../themes';

interface VizTooltipFooterProps {
  dataLinks: Array<LinkModel<Field>>;
  annotate?: () => void;
}

export const ADD_ANNOTATION_ID = 'add-annotation-button';

export const VizTooltipFooter = ({ dataLinks, annotate }: VizTooltipFooterProps) => {
  const styles = useStyles2(getStyles);

  const renderDataLinks = () => {
    const buttonProps: ButtonProps = {
      variant: 'secondary',
    };

    return (
      <HorizontalGroup>
        {dataLinks.map((link, i) => (
          <DataLinkButton key={i} link={link} buttonProps={buttonProps} />
        ))}
      </HorizontalGroup>
    );
  };

  return (
    <div className={styles.wrapper}>
      {dataLinks.length > 0 && <div className={styles.dataLinks}>{renderDataLinks()}</div>}
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
    overflowX: 'auto',
    overflowY: 'hidden',
    whiteSpace: 'nowrap',
    maskImage: 'linear-gradient(90deg, rgba(0, 0, 0, 1) 80%, transparent)',
    borderTop: `1px solid ${theme.colors.border.medium}`,
    padding: theme.spacing(1),
  }),
  addAnnotations: css({
    borderTop: `1px solid ${theme.colors.border.medium}`,
    padding: theme.spacing(1),
  }),
});
