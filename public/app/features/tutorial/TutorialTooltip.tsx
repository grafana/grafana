import { css } from '@emotion/css';
import React, { forwardRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Text, useStyles2 } from '@grafana/ui';

import { type Step } from './tutorialProvider.utils';

export const TutorialTooltip = forwardRef<HTMLDivElement, any>((props, ref) => {
  const { getArrowProps, getTooltipProps, step, advance } = props;
  const styles = useStyles2(getStyles);

  return (
    <div ref={ref} {...getTooltipProps()} className={styles.instructions}>
      <div {...getArrowProps({ className: 'tooltip-arrow' })} />
      {renderStepTitle(step.title)}
      {renderContent(step.content)}
      {advance && (
        <div>
          <Button onClick={advance}>Next</Button>
        </div>
      )}
    </div>
  );
});

function renderStepTitle(title: Step['title']) {
  if (!title) {
    return null;
  }

  if (typeof title === 'string') {
    return (
      <Text element="h2" variant="h6">
        {title}
      </Text>
    );
  }

  return <div>{title}</div>;
}

function renderContent(content: Step['content']) {
  if (!content) {
    return null;
  }

  if (typeof content === 'string') {
    return <div>{content}</div>;
  }

  return <div>{content}</div>;
}

const getStyles = (theme: GrafanaTheme2) => ({
  instructions: css({
    display: `flex`,
    flexDirection: `column`,
    gap: theme.spacing(2),
    zIndex: 1059,
    width: `300px`,
    backgroundColor: theme.colors.background.primary,
    padding: theme.spacing(2),
    borderRadius: theme.shape.radius.default,
  }),
});

TutorialTooltip.displayName = 'TutorialTooltip';
