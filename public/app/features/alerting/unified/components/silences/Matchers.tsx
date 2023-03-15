import { css } from '@emotion/css';
import React from 'react';

import { TagList, useStyles2 } from '@grafana/ui';
import { Matcher } from 'app/plugins/datasource/alertmanager/types';

import { matcherToOperator } from '../../utils/alertmanager';

type MatchersProps = { matchers: Matcher[] };

export const Matchers = ({ matchers }: MatchersProps) => {
  const styles = useStyles2(getStyles);
  return (
    <div>
      <TagList
        className={styles.tags}
        tags={matchers.map((matcher) => `${matcher.name}${matcherToOperator(matcher)}${matcher.value}`)}
      />
    </div>
  );
};

const getStyles = () => ({
  tags: css`
    justify-content: flex-start;
  `,
});
