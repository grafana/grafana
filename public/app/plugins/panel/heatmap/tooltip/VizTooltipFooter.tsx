import { css } from '@emotion/css';
import React from 'react';

import { Field, GrafanaTheme2, LinkModel } from '@grafana/data';
import { Button, ButtonProps, DataLinkButton, HorizontalGroup, useStyles2 } from '@grafana/ui';

interface VizTooltipFooterProps {
  dataLinks: Array<LinkModel<Field>>;
  canAnnotate: boolean;
}

export const ADD_ANNOTATION_ID = 'add-annotation-button';

export const VizTooltipFooter = ({ dataLinks, canAnnotate }: VizTooltipFooterProps) => {
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
      {canAnnotate && (
        <div className={styles.addAnnotations}>
          <Button icon="comment-alt" variant="secondary" size="sm" id={ADD_ANNOTATION_ID}>
            Add annotation
          </Button>
        </div>
      )}
    </div>
  );
};

// @TODO mask
const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    display: flex;
    flex-direction: column;
    flex: 1;
    border-top: 1px solid ${theme.colors.border.medium};
    padding: ${theme.spacing(1)} 0;
  `,
  dataLinks: css`
    height: 40px;
    overflow-x: auto;
    overflow-y: hidden;
    white-space: nowrap;
    border-bottom: 1px solid ${theme.colors.border.medium};
    padding-bottom: ${theme.spacing(1)};
    margin-bottom: 8px;
    //-webkit-mask-image: linear-gradient(90deg, #000 80%, transparent);
  `,
  addAnnotations: css``,
  // fadedMask: css`
  //   display: block;
  //   position: absolute;
  //   width: 200px;
  //   height: 40px;
  //   right: 11px;
  //   bottom: 55px;
  //   pointer-events: none;
  //   background: linear-gradient(to right, transparent 30%, ${theme.colors.background.secondary} 100%);
  //   background: -webkit-gradient(
  //     linear,
  //     left top,
  //     right top,
  //     color-stop(0%, transparent),
  //     color-stop(100%, ${theme.colors.background.secondary})
  //   );
  //   background: -webkit-linear-gradient(left, transparent 30%, ${theme.colors.background.secondary} 100%);
  // `,
});
