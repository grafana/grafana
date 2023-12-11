import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Badge, type BadgeColor, Stack, Text, useStyles2 } from '@grafana/ui';
import { TutorialProgress } from 'app/features/tutorial/TutorialProgress';
import { startTutorial } from 'app/features/tutorial/slice';
import { Tutorial } from 'app/features/tutorial/types';
import { useDispatch } from 'app/types';

type TutorialItemProps = {
  arePreviewing: boolean;
  onPreview: (tutorial: Tutorial['id'] | null) => void;
  tutorial: Tutorial;
};

const badgeColors: Record<keyof Tutorial['tags'], BadgeColor> = {
  area: `blue`,
  type: `yellow`,
  highlight: `orange`,
};

export const TutorialItem = ({ arePreviewing, onPreview, tutorial }: TutorialItemProps) => {
  const dispatch = useDispatch();
  const { id, name, description } = tutorial;
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container} data-testid={`tutorial-item ${id}`}>
      <div className={styles.header}>
        <Text element="h3" variant="h4">
          {name}
        </Text>
        <div className={styles.progressHeader}>
          Progress:
          <TutorialProgress
            currentStep={accountForZeroIndex(tutorial.furthestStepCompleted)}
            totalSteps={tutorial.steps.length}
          />
        </div>
      </div>
      <Stack direction={`column`} gap={2}>
        <div>{description}</div>

        <div className={styles.actions}>
          <Stack>
            <Button
              data-testid="tutorial-item preview"
              icon={arePreviewing ? `eye-slash` : `eye`}
              variant="secondary"
              onClick={() => onPreview(arePreviewing ? null : tutorial.id)}
            >
              Preview tutorial
            </Button>
            <Button
              data-testid="tutorial-item start"
              onClick={() => {
                dispatch(startTutorial(id));
              }}
            >
              Start tutorial
            </Button>
          </Stack>
          {tutorial.tags && (
            <Stack alignItems={`end`}>
              <Stack>
                {Object.entries(tutorial.tags).map(([type, value]) => {
                  // @ts-expect-error
                  return <Badge key={type} text={value} color={badgeColors[type]} />;
                })}
              </Stack>
            </Stack>
          )}
        </div>
      </Stack>
    </div>
  );
};

function accountForZeroIndex(furtherstStep?: number) {
  if (furtherstStep === undefined) {
    return 0;
  }

  return furtherstStep + 1;
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: `flex`,
    flexDirection: `column`,
    gap: theme.spacing(1),
    padding: theme.spacing(2),
    background: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
  }),
  header: css({
    display: `flex`,
    alignItems: `center`,
    justifyContent: `space-between`,
  }),
  progressHeader: css({
    display: `flex`,
    alignItems: `center`,
    gap: theme.spacing(1),
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  actions: css({
    display: `flex`,
    justifyContent: `space-between`,
    gap: theme.spacing(1),
    marginTop: theme.spacing(2),
  }),
});
