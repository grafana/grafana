import { css } from '@emotion/css';
import { take, takeRight, uniqueId } from 'lodash';
import { type FC } from 'react';

import { MatcherBadge as MatcherBadgeView } from '@grafana/alerting/unstable';
import { type GrafanaTheme2 } from '@grafana/data';
import { Stack, useStyles2 } from '@grafana/ui';
import { type ObjectMatcher } from 'app/plugins/datasource/alertmanager/types';

import { type MatcherFormatter, matcherPartsFormatter } from '../../utils/matchers';
import { PopupCard } from '../HoverCard';

type MatchersProps = { matchers: ObjectMatcher[]; formatter?: MatcherFormatter };

// renders the first N number of matchers
const Matchers: FC<MatchersProps> = ({ matchers, formatter = 'default' }) => {
  const styles = useStyles2(getStyles);

  const NUM_MATCHERS = 5;

  const firstFew = take(matchers, NUM_MATCHERS);
  const rest = takeRight(matchers, matchers.length - NUM_MATCHERS);
  const hasMoreMatchers = rest.length > 0;

  return (
    <Stack direction="row" gap={1} alignItems="center" wrap="wrap" data-testid="label-matchers">
      {firstFew.map((matcher) => (
        <MatcherBadge key={uniqueId()} matcher={matcher} formatter={formatter} />
      ))}
      {hasMoreMatchers && (
        <PopupCard
          arrow
          placement="top"
          content={
            <Stack direction="column" gap={1} alignItems="start" justifyContent="start">
              {rest.map((matcher) => (
                <MatcherBadge key={uniqueId()} matcher={matcher} />
              ))}
            </Stack>
          }
        >
          <span>
            <div className={styles.metadata}>{`and ${rest.length} more`}</div>
          </span>
        </PopupCard>
      )}
    </Stack>
  );
};

interface MatcherBadgeProps {
  matcher: ObjectMatcher;
  formatter?: MatcherFormatter;
}

export const MatcherBadge: FC<MatcherBadgeProps> = ({ matcher, formatter = 'default' }) => {
  const [name, operator, value] = matcherPartsFormatter[formatter](matcher);

  // color by the raw label name so the color doesn't change between formatters
  return <MatcherBadgeView name={name} operator={operator} value={value} color={matcher[0]} />;
};

const getStyles = (theme: GrafanaTheme2) => ({
  metadata: css({
    color: theme.colors.text.secondary,

    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.bodySmall.fontWeight,
  }),
});

export { Matchers };
