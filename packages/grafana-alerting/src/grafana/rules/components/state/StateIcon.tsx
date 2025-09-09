import { css, keyframes } from '@emotion/css';
import { upperFirst } from 'lodash';
import { ComponentProps, memo } from 'react';
import type { RequireAtLeastOne } from 'type-fest';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, type IconName, Text, Tooltip, useStyles2, useTheme2 } from '@grafana/ui';

import type { Health, State } from './types';

type TextProps = ComponentProps<typeof Text>;

interface StateIconProps {
  recording?: boolean;
  state?: State;
  health?: Health;
  isPaused?: boolean;
  operation?: RuleOperation;
}

export type RuleOperation = 'creating' | 'deleting';

const icons: Record<State, IconName> = {
  normal: 'check-circle',
  pending: 'circle',
  recovering: 'exclamation-circle',
  firing: 'exclamation-circle',
  unknown: 'question-circle',
};

const color: Record<State, TextProps['color']> = {
  normal: 'success',
  pending: 'warning',
  recovering: 'warning',
  firing: 'error',
  unknown: 'secondary',
};

const stateNames: Record<State, string> = {
  normal: 'Normal',
  pending: 'Pending',
  firing: 'Firing',
  recovering: 'Recovering',
  unknown: 'Unknown',
};

const operationIcons: Record<RuleOperation, IconName> = {
  creating: 'plus-circle',
  deleting: 'minus-circle',
};

// ⚠️ not trivial to update this, you have to re-do the math for the loading spinner
const ICON_SIZE = 15;

/**
 * Make sure that the order of importance here matches the one we use in the StateBadge component for the detail view
 * This component is often rendered tens or hundreds of times in a single page, so it's performance is important
 *
 * @TODO support translations
 */
export const StateIcon = memo(function StateIcon({
  state,
  health,
  recording = false,
  isPaused = false,
  operation,
}: RequireAtLeastOne<StateIconProps>) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();

  let iconName: IconName = state ? icons[state] : 'circle';
  let iconColor: TextProps['color'] = state ? color[state] : 'secondary';
  let stateName: string = state ? stateNames[state] : 'unknown';

  if (recording) {
    iconName = 'record-audio';
    iconColor = 'success';
    stateName = 'Recording';
  }

  if (health === 'nodata') {
    iconName = 'exclamation-triangle';
    iconColor = 'warning';
    stateName = 'Insufficient data';
  }

  if (health === 'error') {
    iconName = 'times-circle';
    iconColor = 'error';
    stateName = 'Failed to evaluate rule';
  }

  if (isPaused) {
    iconName = 'pause-circle';
    iconColor = 'warning';
    stateName = 'Paused';
  }

  if (operation) {
    iconName = operationIcons[operation];
    iconColor = 'secondary';
    stateName = upperFirst(operation);
  }

  return (
    <Text color={iconColor} title={stateName}>
      <div className={styles.iconsContainer}>
        <Icon name={iconName} width={ICON_SIZE} height={ICON_SIZE} />
        {/* this loading spinner works by using an optical illusion;
              the actual icon is static and the "spinning" part is just a semi-transparent darker circle overlayed on top.
              This makes it look like there is a small bright colored spinner rotating.
            */}
        {operation && (
          <svg
            width={ICON_SIZE}
            height={ICON_SIZE}
            viewBox="0 0 20 20"
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            className={styles.spinning}
          >
            <circle
              r={ICON_SIZE / 2}
              cx="10"
              cy="10"
              // make sure to match this color to the color of the list item background where it's being used! Works for both light and dark themes.
              stroke={theme.colors.background.primary}
              strokeWidth="2"
              strokeLinecap="round"
              fill="transparent"
              strokeOpacity={0.85}
              strokeDasharray="20px"
            />
          </svg>
        )}
      </div>
    </Text>
  );
});

const spin = keyframes({
  '0%': {
    transform: 'rotate(0deg)',
  },
  '50%': {
    transform: 'rotate(180deg)',
  },
  '100%': {
    transform: 'rotate(360deg)',
  },
});

const getStyles = (theme: GrafanaTheme2) => ({
  iconsContainer: css({
    position: 'relative',
    width: ICON_SIZE,
    height: ICON_SIZE,
    '> *': {
      position: 'absolute',
    },
  }),
  spinning: css({
    [theme.transitions.handleMotion('no-preference')]: {
      animationName: spin,
      animationIterationCount: 'infinite',
      animationDuration: '1s',
      animationTimingFunction: 'linear',
    },
  }),
});
