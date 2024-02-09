import { css } from '@emotion/css';
import { take, takeRight, uniqueId } from 'lodash';
import React, { FC } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { getTagColorsFromName, useStyles2, Stack } from '@grafana/ui';
import { ObjectMatcher } from 'app/plugins/datasource/alertmanager/types';

import { MatcherFormatter, matcherFormatter } from '../../utils/matchers';
import { HoverCard } from '../HoverCard';

type MatchersProps = { matchers: ObjectMatcher[]; formatter?: MatcherFormatter };

// renders the first N number of matchers
const Matchers: FC<MatchersProps> = ({ matchers, formatter = 'default' }) => {
  const styles = useStyles2(getStyles);

  const NUM_MATCHERS = 5;

  const firstFew = take(matchers, NUM_MATCHERS);
  const rest = takeRight(matchers, matchers.length - NUM_MATCHERS);
  const hasMoreMatchers = rest.length > 0;

  return (
    <span data-testid="label-matchers">
      <Stack direction="row" gap={1} alignItems="center" wrap={'wrap'}>
        {firstFew.map((matcher) => (
          <MatcherBadge key={uniqueId()} matcher={matcher} formatter={formatter} />
        ))}
        {/* TODO hover state to show all matchers we're not showing */}
        {hasMoreMatchers && (
          <HoverCard
            arrow
            placement="top"
            content={
              <>
                {rest.map((matcher) => (
                  <MatcherBadge key={uniqueId()} matcher={matcher} />
                ))}
              </>
            }
          >
            <span>
              <div className={styles.metadata}>{`and ${rest.length} more`}</div>
            </span>
          </HoverCard>
        )}
      </Stack>
    </span>
  );
};

interface MatcherBadgeProps {
  matcher: ObjectMatcher;
  formatter?: MatcherFormatter;
}

const MatcherBadge: FC<MatcherBadgeProps> = ({ matcher, formatter = 'default' }) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.matcher(matcher[0]).wrapper}>
      <Stack direction="row" gap={0} alignItems="baseline">
        {matcherFormatter[formatter](matcher)}
      </Stack>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  matcher: (label: string) => {
    const { color, borderColor } = getTagColorsFromName(label);

    return {
      wrapper: css`
        color: #fff;
        background: ${color};
        padding: ${theme.spacing(0.33)} ${theme.spacing(0.66)};
        font-size: ${theme.typography.bodySmall.fontSize};

        border: solid 1px ${borderColor};
        border-radius: ${theme.shape.borderRadius(2)};
      `,
    };
  },
  metadata: css`
    color: ${theme.colors.text.secondary};

    font-size: ${theme.typography.bodySmall.fontSize};
    font-weight: ${theme.typography.bodySmall.fontWeight};
  `,
});

export { Matchers };
